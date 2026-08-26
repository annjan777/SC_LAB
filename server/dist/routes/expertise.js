import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
const router = Router();
// --- CRUD for each expertise type ---
const EXPERTISE_TABLES = {
    skills: { table: 'user_skills', nameCol: 'skill_name', levelCol: 'proficiency_level' },
    software: { table: 'user_software', nameCol: 'software_name', levelCol: 'proficiency_level' },
    equipment: { table: 'user_equipment', nameCol: 'equipment_name', levelCol: 'experience_level' },
    processes: { table: 'user_processes', nameCol: 'process_name', levelCol: 'experience_level' },
};
function expertiseRoutes(type) {
    const { table, nameCol, levelCol } = EXPERTISE_TABLES[type];
    const r = Router();
    // GET /api/expertise/:type?user_id=...
    r.get('/', authenticate, async (req, res) => {
        try {
            const userId = req.query.user_id || req.user.id;
            const result = await query(`SELECT * FROM ${table} WHERE user_id = $1`, [userId]);
            res.json(result.rows);
        }
        catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });
    // POST /api/expertise/:type
    r.post('/', authenticate, async (req, res) => {
        try {
            const userId = req.body.user_id || req.user.id;
            if (userId !== req.user.id && req.user.user_role !== 'admin' && req.user.user_role !== 'super_admin') {
                return res.status(403).json({ error: 'Forbidden' });
            }
            const name = req.body[nameCol];
            const level = req.body[levelCol] || 'intermediate';
            const result = await query(`INSERT INTO ${table} (user_id, "${nameCol}", "${levelCol}") VALUES ($1, $2, $3) RETURNING *`, [userId, name, level]);
            res.status(201).json(result.rows[0]);
        }
        catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });
    // DELETE /api/expertise/:type/:id
    r.delete('/:id', authenticate, async (req, res) => {
        try {
            // Verify ownership or admin
            const check = await query(`SELECT user_id FROM ${table} WHERE id = $1`, [req.params.id]);
            if (check.rows.length === 0)
                return res.status(404).json({ error: 'Not found' });
            if (check.rows[0].user_id !== req.user.id && req.user.user_role !== 'admin' && req.user.user_role !== 'super_admin') {
                return res.status(403).json({ error: 'Forbidden' });
            }
            await query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
            res.json({ message: 'Deleted' });
        }
        catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });
    return r;
}
// Mount sub-routes
router.use('/skills', expertiseRoutes('skills'));
router.use('/software', expertiseRoutes('software'));
router.use('/equipment', expertiseRoutes('equipment'));
router.use('/processes', expertiseRoutes('processes'));
// Suggestions alias (used by some frontend components)
router.get('/suggestions', authenticate, async (req, res) => {
    try {
        const type = req.query.type;
        const term = req.query.search_term || req.query.term || '';
        let sql = '';
        if (type === 'skill') {
            sql = `SELECT DISTINCT skill_name AS suggestion FROM user_skills WHERE skill_name ILIKE $1 
             UNION SELECT DISTINCT name AS suggestion FROM skills WHERE name ILIKE $1 ORDER BY suggestion LIMIT 10`;
        }
        else if (type === 'software') {
            sql = `SELECT DISTINCT software_name AS suggestion FROM user_software WHERE software_name ILIKE $1 
             UNION SELECT DISTINCT name AS suggestion FROM software WHERE name ILIKE $1 ORDER BY suggestion LIMIT 10`;
        }
        else if (type === 'equipment') {
            sql = `SELECT DISTINCT equipment_name AS suggestion FROM user_equipment WHERE equipment_name ILIKE $1 
             UNION SELECT DISTINCT name AS suggestion FROM equipment_types WHERE name ILIKE $1 ORDER BY suggestion LIMIT 10`;
        }
        else if (type === 'process') {
            sql = `SELECT DISTINCT process_name AS suggestion FROM user_processes WHERE process_name ILIKE $1 
             UNION SELECT DISTINCT name AS suggestion FROM processes WHERE name ILIKE $1 ORDER BY suggestion LIMIT 10`;
        }
        else {
            return res.status(400).json({ error: 'Invalid type' });
        }
        const result = await query(sql, [`%${term}%`]);
        res.json(result.rows.map((r) => r.suggestion));
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// Autocomplete endpoints
router.get('/autocomplete/:type', authenticate, async (req, res) => {
    try {
        const type = req.params.type;
        const term = req.query.term || '';
        let sql = '';
        if (type === 'skill') {
            sql = `SELECT DISTINCT skill_name AS suggestion FROM user_skills WHERE skill_name ILIKE $1 
             UNION SELECT DISTINCT name AS suggestion FROM skills WHERE name ILIKE $1 ORDER BY suggestion LIMIT 10`;
        }
        else if (type === 'software') {
            sql = `SELECT DISTINCT software_name AS suggestion FROM user_software WHERE software_name ILIKE $1 
             UNION SELECT DISTINCT name AS suggestion FROM software WHERE name ILIKE $1 ORDER BY suggestion LIMIT 10`;
        }
        else if (type === 'equipment') {
            sql = `SELECT DISTINCT equipment_name AS suggestion FROM user_equipment WHERE equipment_name ILIKE $1 
             UNION SELECT DISTINCT name AS suggestion FROM equipment_types WHERE name ILIKE $1 ORDER BY suggestion LIMIT 10`;
        }
        else if (type === 'process') {
            sql = `SELECT DISTINCT process_name AS suggestion FROM user_processes WHERE process_name ILIKE $1 
             UNION SELECT DISTINCT name AS suggestion FROM processes WHERE name ILIKE $1 ORDER BY suggestion LIMIT 10`;
        }
        else {
            return res.status(400).json({ error: 'Invalid type' });
        }
        const result = await query(sql, [`%${term}%`]);
        res.json(result.rows.map((r) => r.suggestion));
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
export default router;
