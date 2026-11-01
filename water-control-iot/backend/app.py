from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from datetime import datetime
import random
import os
import firebase_admin
from firebase_admin import credentials, db

app = Flask(__name__)
CORS(app)

# ==================== CONFIGURATION FIREBASE ====================
FIREBASE_CRED_PATH = 'serviceAccountKey.json'
FIREBASE_DATABASE_URL = 'https://water-quality-monitor-b4ced-default-rtdb.europe-west1.firebasedatabase.app/'

firebase_initialized = False
firebase_db_ref = None

try:
    if os.path.exists(FIREBASE_CRED_PATH):
        cred = credentials.Certificate(FIREBASE_CRED_PATH)
        firebase_admin.initialize_app(cred, {'databaseURL': FIREBASE_DATABASE_URL})
        firebase_db_ref = db.reference('/')
        firebase_initialized = True
        print("✅ Firebase initialisé avec succès")
    else:
        print(f"⚠️ Fichier {FIREBASE_CRED_PATH} non trouvé - Firebase désactivé")
except Exception as e:
    print(f"❌ Erreur Firebase: {e}")

# ==================== CONFIGURATION MySQL ====================
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'database': 'water_quality_db'
}

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

def serialize_row(row):
    """
    Convertit une ligne MySQL en dict JSON-sérialisable.
    Gère les types Decimal et datetime proprement.
    """
    result = {}
    for key, value in row.items():
        if hasattr(value, 'isoformat'):          # datetime / date
            result[key] = value.isoformat(sep=' ')
        elif hasattr(value, '__float__'):         # Decimal
            result[key] = float(value)
        else:
            result[key] = value
    return result

def init_database():
    try:
        conn = mysql.connector.connect(
            host='localhost', user='root', password=''
        )
        cursor = conn.cursor()
        cursor.execute("CREATE DATABASE IF NOT EXISTS water_quality_db")
        cursor.execute("USE water_quality_db")

        # ── BUG FIX : la table doit s'appeler sensor_data partout ──
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sensor_data (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ph DECIMAL(4,2) NOT NULL,
                tds INT NOT NULL,
                turbidity DECIMAL(5,2) NOT NULL,
                temperature DECIMAL(5,2) NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

        cursor.execute("SELECT COUNT(*) FROM sensor_data")
        if cursor.fetchone()[0] == 0:
            test_data = [
                (7.2, 320, 2.5, 22.5),
                (7.1, 315, 2.3, 22.0),
                (7.3, 330, 2.8, 23.0),
                (7.0, 310, 2.2, 21.5),
                (7.4, 340, 3.0, 23.5),
            ]
            for d in test_data:
                cursor.execute(
                    "INSERT INTO sensor_data (ph, tds, turbidity, temperature) VALUES (%s,%s,%s,%s)", d
                )
            conn.commit()
            print("✅ Données de test insérées")

        cursor.close()
        conn.close()
        print("✅ Base de données MySQL initialisée")
    except Exception as e:
        print(f"❌ Erreur MySQL init: {e}")

# ==================== FIREBASE SYNC ====================
def sync_to_firebase(data_id, data):
    if not firebase_initialized:
        return
    try:
        ts = datetime.now().isoformat()
        firebase_db_ref.child('sensors/all_data').child(str(data_id)).set({
            'id': data_id, 'ph': data['ph'], 'tds': data['tds'],
            'turbidity': data['turbidity'], 'temperature': data['temperature'],
            'timestamp': ts
        })
        firebase_db_ref.child('sensors/current').set({
            'ph': data['ph'], 'tds': data['tds'],
            'turbidity': data['turbidity'], 'temperature': data['temperature'],
            'timestamp': ts
        })
        print(f"✅ Donnée {data_id} synchronisée vers Firebase")
    except Exception as e:
        print(f"❌ Erreur sync Firebase: {e}")

def sync_all_to_firebase():
    if not firebase_initialized:
        return False
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM sensor_data ORDER BY id")
        all_data = cursor.fetchall()
        cursor.close()
        conn.close()

        ref = firebase_db_ref.child('sensors/all_data')
        for item in all_data:
            ref.child(str(item['id'])).set({
                'id': item['id'],
                'ph': float(item['ph']),
                'tds': item['tds'],
                'turbidity': float(item['turbidity']),
                'temperature': float(item['temperature']),
                'timestamp': item['timestamp'].isoformat() if hasattr(item['timestamp'], 'isoformat') else str(item['timestamp'])
            })

        if all_data:
            last = all_data[-1]
            firebase_db_ref.child('sensors/current').set({
                'ph': float(last['ph']), 'tds': last['tds'],
                'turbidity': float(last['turbidity']),
                'temperature': float(last['temperature']),
                'timestamp': last['timestamp'].isoformat() if hasattr(last['timestamp'], 'isoformat') else str(last['timestamp'])
            })

        print(f"✅ Sync totale: {len(all_data)} lignes → Firebase")
        return True
    except Exception as e:
        print(f"❌ Erreur sync totale: {e}")
        return False

# ==================== ENDPOINTS ====================

@app.route('/api/health', methods=['GET'])
def health():
    # ── Teste aussi la connexion MySQL ──
    db_ok = False
    db_error = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM sensor_data")
        count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        db_ok = True
    except Exception as e:
        db_error = str(e)

    return jsonify({
        'status': 'ok',
        'mysql': db_ok,
        'mysql_error': db_error,
        'firebase': firebase_initialized,
        'timestamp': datetime.now().isoformat()
    })


@app.route('/api/data', methods=['GET'])
def get_data():
    """
    Retourne :
      - current  : la mesure la plus récente (par timestamp DESC)
      - history  : les 100 dernières mesures triées du plus ancien au plus récent
    
    BUG FIX : on utilise ORDER BY id DESC pour éviter les problèmes
    de timestamp identique, et on convertit proprement Decimal/datetime.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # ── Historique : 100 dernières lignes, ordre chronologique ──
        cursor.execute("""
            SELECT * FROM sensor_data
            ORDER BY id DESC
            LIMIT 100
        """)
        rows = cursor.fetchall()
        history = [serialize_row(r) for r in reversed(rows)]  # plus ancien → plus récent

        # ── Mesure courante : la plus récente par id ──
        current = history[-1] if history else None

        cursor.close()
        conn.close()

        return jsonify({'success': True, 'current': current, 'history': history})

    except Exception as e:
        print(f"❌ /api/data GET error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/data', methods=['POST'])
def add_data():
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'error': 'Corps JSON manquant'}), 400

        required = ['ph', 'tds', 'turbidity', 'temperature']
        for field in required:
            if field not in data:
                return jsonify({'success': False, 'error': f'Champ manquant : {field}'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO sensor_data (ph, tds, turbidity, temperature) VALUES (%s,%s,%s,%s)",
            (data['ph'], data['tds'], data['turbidity'], data['temperature'])
        )
        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()

        sync_to_firebase(new_id, data)

        return jsonify({'success': True, 'message': 'Ajouté', 'id': new_id})
    except Exception as e:
        print(f"❌ /api/data POST error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/generate', methods=['POST'])
def generate():
    try:
        new_data = {
            'ph':          round(random.uniform(6.0, 9.0), 2),
            'tds':         random.randint(200, 600),
            'turbidity':   round(random.uniform(1.0, 8.0), 2),
            'temperature': round(random.uniform(15.0, 30.0), 2)
        }

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO sensor_data (ph, tds, turbidity, temperature) VALUES (%s,%s,%s,%s)",
            (new_data['ph'], new_data['tds'], new_data['turbidity'], new_data['temperature'])
        )
        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()

        sync_to_firebase(new_id, new_data)

        return jsonify({'success': True, 'data': new_data, 'id': new_id})
    except Exception as e:
        print(f"❌ /api/generate error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/sync-firebase', methods=['POST'])
def sync_firebase():
    if not firebase_initialized:
        return jsonify({'success': False, 'error': 'Firebase non configuré'}), 400
    success = sync_all_to_firebase()
    if success:
        return jsonify({'success': True, 'message': 'Synchronisation complète'})
    return jsonify({'success': False, 'error': 'Erreur synchronisation'}), 500


@app.route('/api/firebase-status', methods=['GET'])
def firebase_status():
    return jsonify({
        'initialized': firebase_initialized,
        'database_url': FIREBASE_DATABASE_URL if firebase_initialized else None,
        'message': 'Firebase connecté' if firebase_initialized else 'Firebase non configuré'
    })


# ==================== LANCEMENT ====================
if __name__ == '__main__':
    print("=" * 55)
    print("🚀  Démarrage du serveur Flask — Water Quality IoT")
    print("=" * 55)
    init_database()

    if firebase_initialized:
        print("🔄 Synchronisation initiale vers Firebase...")
        sync_all_to_firebase()

    print("\n📡 API : http://localhost:5000")
    print("   GET  /api/health")
    print("   GET  /api/data")
    print("   POST /api/data")
    print("   POST /api/generate")
    print("   POST /api/sync-firebase")
    print("   GET  /api/firebase-status")
    print("=" * 55)

    app.run(debug=True, port=5000)