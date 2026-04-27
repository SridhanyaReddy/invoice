const API_BASE = '/api';

const api = {
    async getOrganization() {
        const res = await fetch(`${API_BASE}/organization`);
        return res.json();
    },

    async saveOrganization(data) {
        const res = await fetch(`${API_BASE}/organization`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async getInvoices() {
        const res = await fetch(`${API_BASE}/invoices`);
        return res.json();
    },

    async getInvoiceById(id) {
        const res = await fetch(`${API_BASE}/invoices/${id}`);
        return res.json();
    },

    async createInvoice(data) {
        const res = await fetch(`${API_BASE}/invoices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async updateInvoice(id, data) {
        const res = await fetch(`${API_BASE}/invoices/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async deleteInvoice(id) {
        const res = await fetch(`${API_BASE}/invoices/${id}`, {
            method: 'DELETE'
        });
        return res.json();
    }
};
