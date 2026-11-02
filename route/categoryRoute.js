import express from 'express'
import {
    createCategory,
    getCategories,
    getCategory,
    updateCategory,
    deleteCategory
} from '../controller/categoryController.js'
import authenticateToken from '../utils/authMiddleware.js'
import authorizeAdmin from '../utils/authorizeAdmin.js'

const categoryRouter = express.Router()

categoryRouter.post('/api/categories', authenticateToken, authorizeAdmin, createCategory)
categoryRouter.get('/api/categories', authenticateToken, getCategories)
categoryRouter.get('/api/categories/:id', authenticateToken, getCategory)
categoryRouter.put('/api/categories/:id', authenticateToken, authorizeAdmin, updateCategory)
categoryRouter.delete('/api/categories/:id', authenticateToken, authorizeAdmin, deleteCategory)

export default categoryRouter