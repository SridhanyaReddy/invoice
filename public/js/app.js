const app = {
    state: {
        organization: null,
        invoices: [],
        currentTheme: localStorage.getItem('theme') || 'light'
    },

    init() {
        this.bindEvents();
        this.applyTheme();
        this.loadData();
    },

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.getAttribute('data-page');
                this.showPage(page);
            });
        });

        // Theme Toggle
        document.getElementById('toggle-theme').addEventListener('click', () => this.toggleTheme());

        // Invoice Form
        document.getElementById('invoice-form').addEventListener('submit', (e) => this.handleInvoiceSubmit(e));
        document.getElementById('save-download-btn').addEventListener('click', (e) => this.handleInvoiceSubmit(e, true));

        // Settings Form
        document.getElementById('settings-form').addEventListener('submit', (e) => this.handleSettingsSubmit(e));

        // Logo Upload
        document.getElementById('org-logo-input').addEventListener('change', (e) => this.handleLogoUpload(e));

        // Search
        document.getElementById('search-btn').addEventListener('click', () => this.handleSearch());
        document.getElementById('search-input').addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        // Balance Calculation
        ['total-amount', 'advance-payment'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.updateBalance());
        });
    },

    async loadData() {
        this.showLoading(true);
        try {
            const [org, invoices] = await Promise.all([
                api.getOrganization(),
                api.getInvoices()
            ]);

            this.state.organization = org;
            this.state.invoices = invoices;

            // Sync to local storage as backup
            localStorage.setItem('backup_org', JSON.stringify(org));
            localStorage.setItem('backup_invoices', JSON.stringify(invoices));

            this.renderInvoices(invoices);
            this.fillSettingsForm();
        } catch (err) {
            console.error('Failed to load data from server, using local fallback', err);
            this.showToast('Backend offline - Using local storage fallback', 'warning');

            const backupOrg = localStorage.getItem('backup_org');
            const backupInvoices = localStorage.getItem('backup_invoices');

            if (backupOrg) this.state.organization = JSON.parse(backupOrg);
            if (backupInvoices) this.state.invoices = JSON.parse(backupInvoices);

            this.renderInvoices(this.state.invoices);
            this.fillSettingsForm();
        } finally {
            this.showLoading(false);
        }
    },

    showPage(pageId) {
        document.querySelectorAll('.page-section').forEach(sec => sec.style.display = 'none');
        document.getElementById(`${pageId}-section`).style.display = 'block';

        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.getAttribute('data-page') === pageId);
        });

        const titles = {
            'dashboard': 'Dashboard',
            'create-invoice': 'Create Invoice',
            'settings': 'Settings'
        };
        document.getElementById('page-title').innerText = titles[pageId] || 'Dashboard';

        if (pageId === 'create-invoice') {
            this.resetInvoiceForm();
        }
    },

    renderInvoices(invoices) {
        const list = document.getElementById('invoice-list');
        if (!invoices || invoices.length === 0) {
            list.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No invoices found.</p>`;
            return;
        }

        list.innerHTML = invoices.map(inv => `
            <div class="invoice-item" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid var(--border-color);">
                <div>
                    <strong style="font-size: 1.1rem;">${inv.customerName}</strong>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">ID: ${inv.invoiceId} | Date: ${new Date(inv.createdAt).toLocaleDateString()}</div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary" onclick="app.viewInvoice('${inv._id}')" title="View"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-secondary" onclick="app.editInvoice('${inv._id}')" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-secondary" onclick="app.downloadPDF('${inv._id}')" title="Download"><i class="fas fa-download"></i></button>
                    <button class="btn btn-secondary" style="color: var(--danger);" onclick="app.deleteInvoice('${inv._id}')" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    },

    async handleInvoiceSubmit(e, shouldDownload = false) {
        if (e) e.preventDefault();
        this.showLoading(true);

        const mongoId = document.getElementById('invoice-mongodb-id').value;
        const customId = document.getElementById('invoice-custom-id').value;

        const formData = {
            customerName: document.getElementById('customer-name').value,
            customerEmail: document.getElementById('customer-email').value,
            phone: document.getElementById('customer-phone').value,
            address: document.getElementById('customer-address').value,
            eventName: document.getElementById('event-name').value,
            packageDetails: document.getElementById('package-details').value,
            totalAmount: Number(document.getElementById('total-amount').value),
            advancePayment: Number(document.getElementById('advance-payment').value),
            advanceDate: document.getElementById('advance-date').value || null,
            installments: this.getInstallmentsFromForm(),
            invoiceId: customId || `INV-${Date.now().toString().slice(-6)}`
        };

        try {
            let savedInvoice;
            if (mongoId) {
                savedInvoice = await api.updateInvoice(mongoId, formData);
                this.showToast('Invoice updated successfully');
            } else {
                savedInvoice = await api.createInvoice(formData);
                this.showToast('Invoice created successfully');
            }

            await this.loadData();

            if (shouldDownload && savedInvoice) {
                this.downloadPDF(savedInvoice._id);
            }

            this.showPage('dashboard');
        } catch (err) {
            console.error('API failed, saving to local backup', err);
            this.showToast('Server error - saved locally', 'warning');

            const localId = mongoId || 'local-' + Date.now();
            const localInvoice = { ...formData, _id: localId, createdAt: new Date().toISOString() };

            if (mongoId) {
                const index = this.state.invoices.findIndex(i => i._id === mongoId);
                if (index !== -1) this.state.invoices[index] = localInvoice;
            } else {
                this.state.invoices.push(localInvoice);
            }

            localStorage.setItem('backup_invoices', JSON.stringify(this.state.invoices));
            this.renderInvoices(this.state.invoices);

            if (shouldDownload) {
                this.downloadPDF(localId);
            }

            this.showPage('dashboard');
        } finally {
            this.showLoading(false);
        }
    },

    async editInvoice(id) {
        const inv = this.state.invoices.find(i => i._id === id);
        if (!inv) return;

        this.showPage('create-invoice');
        document.getElementById('page-title').innerText = 'Edit Invoice';
        document.getElementById('submit-btn-text').innerText = 'Update Invoice';
        document.getElementById('invoice-mongodb-id').value = inv._id;
        document.getElementById('invoice-custom-id').value = inv.invoiceId;

        document.getElementById('customer-name').value = inv.customerName;
        document.getElementById('customer-email').value = inv.customerEmail;
        document.getElementById('customer-address').value = inv.address;
        document.getElementById('event-name').value = inv.eventName || '';
        document.getElementById('package-details').value = inv.packageDetails || '';
        document.getElementById('total-amount').value = inv.totalAmount || 0;
        document.getElementById('advance-payment').value = inv.advancePayment;
        document.getElementById('advance-date').value = inv.advanceDate ? inv.advanceDate.split('T')[0] : '';
        
        this.renderInstallmentsInForm(inv.installments || []);
        this.updateBalance();
    },

    async deleteInvoice(id) {
        if (!confirm('Are you sure you want to delete this invoice?')) return;

        this.showLoading(true);
        try {
            await api.deleteInvoice(id);
            this.showToast('Invoice deleted');
            await this.loadData();
        } catch (err) {
            console.error('API failed, deleting from local backup', err);
            this.state.invoices = this.state.invoices.filter(i => i._id !== id);
            localStorage.setItem('backup_invoices', JSON.stringify(this.state.invoices));
            this.renderInvoices(this.state.invoices);
            this.showToast('Server error - deleted locally', 'warning');
        } finally {
            this.showLoading(false);
        }
    },

    async handleSettingsSubmit(e) {
        e.preventDefault();
        this.showLoading(true);

        const data = {
            name: document.getElementById('org-name').value,
            email: document.getElementById('org-email').value,
            phone: document.getElementById('org-phone').value,
            logo: this.state.tempLogo || (this.state.organization ? this.state.organization.logo : null)
        };

        try {
            const updated = await api.saveOrganization(data);
            this.state.organization = updated;
            this.showToast('Settings saved successfully');
            localStorage.setItem('backup_org', JSON.stringify(updated));
        } catch (err) {
            console.error('API failed, saving settings to local backup', err);
            this.state.organization = data;
            localStorage.setItem('backup_org', JSON.stringify(data));
            this.showToast('Server error - saved settings locally', 'warning');
        } finally {
            this.showLoading(false);
        }
    },

    handleLogoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            this.state.tempLogo = base64;
            document.getElementById('logo-preview').innerHTML = `<img src="${base64}" style="width: 100%; height: 100%; object-fit: contain;">`;
        };
        reader.readAsDataURL(file);
    },

    fillSettingsForm() {
        if (!this.state.organization) return;
        const org = this.state.organization;
        document.getElementById('org-name').value = org.name || '';
        document.getElementById('org-email').value = org.email || '';
        document.getElementById('org-phone').value = org.phone || '';
        if (org.logo) {
            document.getElementById('logo-preview').innerHTML = `<img src="${org.logo}" style="width: 100%; height: 100%; object-fit: contain;">`;
        }
    },

    handleSearch() {
        const query = document.getElementById('search-input').value.toLowerCase();
        const filtered = this.state.invoices.filter(inv =>
            inv.customerName.toLowerCase().includes(query) ||
            inv.phone.includes(query) ||
            inv.invoiceId.toLowerCase().includes(query)
        );
        this.renderInvoices(filtered);
    },

    resetInvoiceForm() {
        document.getElementById('invoice-form').reset();
        document.getElementById('invoice-mongodb-id').value = '';
        document.getElementById('invoice-custom-id').value = '';
        document.getElementById('submit-btn-text').innerText = 'Save Invoice';
        document.getElementById('installments-container').innerHTML = '';
        this.updateBalance();
    },

    addInstallmentRow(data = { amount: '', date: '', description: '' }) {
        const container = document.getElementById('installments-container');
        const row = document.createElement('div');
        row.className = 'grid grid-3 installment-row';
        row.style.marginBottom = '0.75rem';
        row.innerHTML = `
            <div class="form-group" style="margin-bottom: 0;">
                <input type="number" placeholder="Amount (₹)" class="form-control inst-amount" value="${data.amount}" required>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <input type="date" class="form-control inst-date" value="${data.date ? data.date.split('T')[0] : ''}" required>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <input type="text" placeholder="Note" class="form-control inst-desc" value="${data.description}" style="flex: 1;">
                <button type="button" class="btn btn-secondary" onclick="this.closest('.installment-row').remove(); app.updateBalance();" style="padding: 0 0.75rem;">
                    <i class="fas fa-trash text-danger"></i>
                </button>
            </div>
        `;
        container.appendChild(row);
        
        row.querySelector('.inst-amount').addEventListener('input', () => this.updateBalance());
    },

    getInstallmentsFromForm() {
        const rows = document.querySelectorAll('.installment-row');
        return Array.from(rows).map(row => ({
            amount: Number(row.querySelector('.inst-amount').value),
            date: row.querySelector('.inst-date').value,
            description: row.querySelector('.inst-desc').value
        }));
    },

    renderInstallmentsInForm(installments) {
        document.getElementById('installments-container').innerHTML = '';
        installments.forEach(inst => this.addInstallmentRow(inst));
    },

    updateBalance() {
        const total = Number(document.getElementById('total-amount').value) || 0;
        const advance = Number(document.getElementById('advance-payment').value) || 0;
        
        const installmentTotal = this.getInstallmentsFromForm().reduce((sum, inst) => sum + inst.amount, 0);
        
        const remaining = total - advance - installmentTotal;
        document.getElementById('remaining-balance-display').innerText = `₹${remaining.toFixed(2)}`;
    },

    toggleTheme() {
        this.state.currentTheme = this.state.currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.state.currentTheme);
        this.applyTheme();
    },

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.state.currentTheme);
        const btn = document.getElementById('toggle-theme');
        if (this.state.currentTheme === 'dark') {
            btn.innerHTML = `<i class="fas fa-sun"></i> Light Mode`;
        } else {
            btn.innerHTML = `<i class="fas fa-moon"></i> Dark Mode`;
        }
    },

    showLoading(show) {
        document.getElementById('loading-spinner').style.display = show ? 'block' : 'none';
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    viewInvoice(id) {
        const inv = this.state.invoices.find(i => i._id === id);
        const org = this.state.organization;
        if (!inv) return;

        const content = this.generateInvoiceHTML(inv, org);
        document.getElementById('modal-content').innerHTML = content;
        document.getElementById('invoice-modal').style.display = 'flex';
        
        document.getElementById('modal-download-btn').onclick = () => this.downloadPDF(id);
    },

    closeModal() {
        document.getElementById('invoice-modal').style.display = 'none';
    },

    generateInvoiceHTML(inv, org) {
        return `
            <div style="padding: 20px; color: #333; background: #fff; font-family: sans-serif;">
                <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px;">
                    <div>
                        ${org && org.logo ? `<img src="${org.logo}" style="max-height: 60px; margin-bottom: 10px;">` : ''}
                        <h1 style="margin: 0; color: #2563eb;">${org ? org.name : 'Organization'}</h1>
                        <p style="margin: 5px 0;">${org ? org.email : ''} | ${org ? org.phone : ''}</p>
                    </div>
                    <div style="text-align: right;">
                        <h2 style="margin: 0;">INVOICE</h2>
                        <p style="margin: 5px 0;"><strong>ID:</strong> ${inv.invoiceId}</p>
                        <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(inv.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>

                <div style="margin-bottom: 30px;">
                    <h3 style="border-bottom: 1px solid #eee; padding-bottom: 5px;">BILL TO:</h3>
                    <p style="margin: 5px 0;"><strong>${inv.customerName}</strong></p>
                    <p style="margin: 5px 0;">${inv.customerEmail}</p>
                    <p style="margin: 5px 0;">${inv.phone}</p>
                    <p style="margin: 5px 0;">${inv.address}</p>
                </div>

                ${inv.eventName || inv.packageDetails ? `
                <div style="margin-bottom: 30px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                    ${inv.eventName ? `<p style="margin: 0 0 10px 0; font-weight: bold; color: #2563eb; font-size: 1.1rem;">Event: ${inv.eventName}</p>` : ''}
                    ${inv.packageDetails ? `
                        <p style="margin: 0; font-size: 0.9rem; color: #64748b; white-space: pre-line;">
                            <strong>Package Includes:</strong><br>${inv.packageDetails}
                        </p>` : ''}
                </div>` : ''}

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                        <tr style="background: #f8fafc; text-align: left;">
                            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0;">Description</th>
                            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0;">Date</th>
                            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0; text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">Total Project Amount</td>
                            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">-</td>
                            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹${inv.totalAmount.toFixed(2)}</td>
                        </tr>
                        <tr style="color: var(--success);">
                            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">Advance Payment</td>
                            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${inv.advanceDate ? new Date(inv.advanceDate).toLocaleDateString() : '-'}</td>
                            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">-₹${inv.advancePayment.toFixed(2)}</td>
                        </tr>
                        ${inv.installments.map(inst => `
                            <tr style="color: var(--primary-color);">
                                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">Installment: ${inst.description || 'Scheduled'}</td>
                                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${new Date(inst.date).toLocaleDateString()}</td>
                                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">-₹${inst.amount.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="font-weight: bold; font-size: 1.2rem;">
                            <td colspan="2" style="padding: 12px; text-align: right;">REMAINING BALANCE:</td>
                            <td style="padding: 12px; text-align: right; color: #ef4444;">₹${(inv.totalAmount - inv.advancePayment - inv.installments.reduce((s, i) => s + i.amount, 0)).toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>

                <div style="margin-top: 50px; font-size: 0.8rem; color: #666; text-align: center; border-top: 1px solid #eee; padding-top: 10px;">
                    Thank you for your business!
                </div>
            </div>
        `;
    },

    async downloadPDF(id) {
        const inv = this.state.invoices.find(i => i._id === id);
        const org = this.state.organization;
        if (!inv || !org) {
            this.showToast('Please set up Organization details first', 'error');
            return;
        }

        const element = document.createElement('div');
        element.innerHTML = this.generateInvoiceHTML(inv, org);
        element.style.padding = '20px'; // Add some padding for the PDF


        const opt = {
            margin: 0,
            filename: `Invoice_${inv.invoiceId}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        html2pdf().from(element).set(opt).save();
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
