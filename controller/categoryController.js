import mongoose from 'mongoose'
import Category from '../model/category.js'

export const createCategory = async (req, res) => {
    try {
        const { name, description } = req.body ?? {}
        if (typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ message: 'Category name is required' })
        }

        const category = await Category.create({
            name: name.trim(),
            description: typeof description === 'string' ? description.trim() : ''
        })

        return res.status(201).json({ message: 'Category created successfully', data: category })
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Category name already exists' })
        }
        return res.status(500).json({ message: error.message })
    }
}

export const getCategories = async (_req, res) => {
    try {
        const categories = await Category.find().sort({ name: 1 })
        return res.status(200).json({ message: 'Categories fetched successfully', data: categories })
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

export const getCategory = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid category ID' })
        }

        const category = await Category.findById(req.params.id)
        if (!category) {
            return res.status(404).json({ message: 'Category not found' })
        }

        return res.status(200).json({ message: 'Category fetched successfully', data: category })
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

export const updateCategory = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid category ID' })
        }

        const updates = {}
        if (req.body?.name !== undefined) {
            if (typeof req.body.name !== 'string' || !req.body.name.trim()) {
                return res.status(400).json({ message: 'Category name cannot be empty' })
            }
            updates.name = req.body.name.trim()
        }
        if (req.body?.description !== undefined) {
            if (typeof req.body.description !== 'string') {
                return res.status(400).json({ message: 'Description must be a string' })
            }
            updates.description = req.body.description.trim()
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'Provide a category name or description to update' })
        }

        const category = await Category.findByIdAndUpdate(req.params.id, updates, {
            new: true,
            runValidators: true
        })
        if (!category) {
            return res.status(404).json({ message: 'Category not found' })
        }

        return res.status(200).json({ message: 'Category updated successfully', data: category })
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Category name already exists' })
        }
        return res.status(500).json({ message: error.message })
    }
}

export const deleteCategory = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid category ID' })
        }

        const category = await Category.findByIdAndDelete(req.params.id)
        if (!category) {
            return res.status(404).json({ message: 'Category not found' })
        }

        return res.status(200).json({ message: 'Category deleted successfully', data: category })
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}