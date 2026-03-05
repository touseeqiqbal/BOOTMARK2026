class SubmissionService {
    constructor(database) {
        this.dbFunctions = database || require('./db');
    }

    get getDoc() { return this.dbFunctions.getDoc; }
    get setDoc() { return this.dbFunctions.setDoc; }
    get getCollectionRef() { return this.dbFunctions.getCollectionRef; }
    get deleteDoc() { return this.dbFunctions.deleteDoc; }

    async getSubmissionById(id) {
        return await this.getDoc('submissions', id);
    }

    async getSubmissionsByBusinessId(businessId, limit = 50, lastId = null) {
        let query = this.getCollectionRef('submissions')
            .where('businessId', '==', businessId)
            .orderBy('submittedAt', 'desc')
            .limit(limit);

        if (lastId) {
            const lastDoc = await this.getCollectionRef('submissions').doc(lastId).get();
            if (lastDoc.exists) {
                query = query.startAfter(lastDoc);
            }
        }

        const snap = await query.get();
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));
        return items;
    }

    async getSubmissionsByFormIds(formIds) {
        if (!formIds || formIds.length === 0) return [];
        // Legacy fallback for forms without businessId tracking on submissions
        // but for high scale we should prefer getSubmissionsByBusinessId
        const snap = await this.getCollectionRef('submissions').get();
        const items = [];
        snap.forEach(d => {
            const data = d.data();
            if (formIds.includes(data.formId)) items.push({ id: d.id, ...data });
        });
        return items;
    }

    async getSubmissionsByFormId(formId) {
        const snap = await this.getCollectionRef('submissions').where('formId', '==', formId).get();
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));
        return items;
    }

    async createSubmission(submissionData) {
        const id = submissionData.id || Date.now().toString();
        const score = this.calculateLeadScore(submissionData.data || {});
        const newSubmission = {
            ...submissionData,
            id,
            submittedAt: submissionData.submittedAt || new Date().toISOString(),
            leadScore: score,
            isHotLead: score >= 50
        };
        await this.setDoc('submissions', id, newSubmission);
        return newSubmission;
    }

    calculateLeadScore(data) {
        let score = 0;
        const highPriorityKeywords = ['emergency', 'asap', 'leaking', 'broken', 'installation', 'urgent', 'now', 'failure'];
        const mediumPriorityKeywords = ['inquiry', 'quote', 'interested', 'project', 'request', 'estimate'];

        // Convert data values to a single string for analysis
        const content = Object.values(data).join(' ').toLowerCase();

        highPriorityKeywords.forEach(kw => {
            if (content.includes(kw)) score += 50;
        });

        mediumPriorityKeywords.forEach(kw => {
            if (content.includes(kw)) score += 20;
        });

        // Limit score to 100
        return Math.min(score, 100);
    }

    async deleteSubmission(id) {
        await this.deleteDoc('submissions', id);
        return true;
    }
}

module.exports = new SubmissionService();
module.exports.SubmissionService = SubmissionService;
