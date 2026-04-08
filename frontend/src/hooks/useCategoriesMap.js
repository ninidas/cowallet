import { useState, useEffect } from 'react'
import { api } from '../api'

// Returns { categoriesMap: Map<name, {icon, color}>, categories: [] }
export function useCategoriesMap() {
  const [categories, setCategories] = useState([])

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {})
  }, [])

  const categoriesMap = new Map(categories.map(c => [c.name, c]))
  return { categories, categoriesMap }
}
