import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export const api = {
  health: async () => {
    const response = await axios.get(`${API_URL}/health`);
    return response.data;
  },
  
  getData: async () => {
    const response = await axios.get(`${API_URL}/data`);
    return response.data;
  },
  
  addData: async (data) => {
    const response = await axios.post(`${API_URL}/data`, data);
    return response.data;
  },
  
  generateData: async () => {
    const response = await axios.post(`${API_URL}/generate`);
    return response.data;
  }
};