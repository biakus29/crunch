import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import {
  FaSearch,
  FaPlus,
  FaMinus,
  FaCheck,
  FaTimes,
  FaShoppingCart,
  FaExclamationTriangle,
  FaChevronLeft,
  FaChevronRight,
  FaMoneyBillWave,
  FaCalendarAlt,
} from 'react-icons/fa';
import { toast } from 'react-toastify';

const PurchaseListCreator = ({ currentRestaurantId, onClose, onSave, monthlyBudget, currentSpent }) => {
  const [step, setStep] = useState(1) // 1: Info, 2: Ingredients, 3: Review
  const [dragY, setDragY] = useState(0)
  
  // Fermer toutes les modals enfants avant de fermer la modal principale
  const handleClose = () => {
    if (modalIngredient) {
      setModalIngredient(null)
      return
    }
    if (showAddIngredientModal) {
      setShowAddIngredientModal(false)
      return
    }
    onClose()
  }
  const [ingredients, setIngredients] = useState([])
  const [labels, setLabels] = useState([])
  const [selectedIngredients, setSelectedIngredients] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedLabel, setSelectedLabel] = useState("")
  const [loading, setLoading] = useState(true)
  const [modalIngredient, setModalIngredient] = useState(null)
  const [showAddIngredientModal, setShowAddIngredientModal] = useState(false)
  const [newIngredientForm, setNewIngredientForm] = useState({
    name: "",
    labelId: "",
    unit: "",
    unitPrice: 0,
  })
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [purchaseInfo, setPurchaseInfo] = useState({
    date: new Date().toISOString().split("T")[0],
    brands: [],
    notes: "",
    type: "completed", // "completed" pour achat effectué, "request" pour demande
  })

  const brands = ["Crunchfood", "Mange d'abord"]
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

  useEffect(() => {
    loadData()
  }, [currentRestaurantId])

  // Gestion de la touche Échap pour fermer les modals
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [modalIngredient, showAddIngredientModal])

  const loadData = async () => {
    try {
      setLoading(true)
      const [ingredientsSnap, labelsSnap] = await Promise.all([
        getDocs(
          query(collection(db, "ingredients"), where("restaurantId", "==", currentRestaurantId), orderBy("name")),
        ),
        getDocs(query(collection(db, "ingredientLabels"), where("restaurantId", "==", currentRestaurantId))),
      ])

      setIngredients(ingredientsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
      setLabels(labelsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
      setLoading(false)
    } catch (error) {
      console.error("Erreur chargement données:", error)
      toast.error("Erreur lors du chargement des données")
      setLoading(false)
    }
  }

  const toggleIngredient = (ingredient) => {
    const isSelected = selectedIngredients.find((sel) => sel.id === ingredient.id)
    if (isSelected) {
      removeSelectedIngredient(ingredient.id)
    } else {
      const defaultUnit = ingredient.units?.[0]?.name || "unité"
      const defaultPrice = Number(ingredient.units?.[0]?.price) || 0
      const newIngredient = {
        ...ingredient,
        quantity: 1,
        selectedUnit: defaultUnit,
        unitPrice: defaultPrice,
        total: defaultPrice,
      }
      setSelectedIngredients((prev) => [...prev, newIngredient])
      setModalIngredient(newIngredient)
    }
  }

  const addIngredientsByLabel = (labelId) => {
    const labelIngredients = ingredients.filter((ing) => ing.labelId === labelId)
    const newSelected = []
    labelIngredients.forEach((ingredient) => {
      if (!selectedIngredients.find((sel) => sel.id === ingredient.id)) {
        const defaultUnit = ingredient.units?.[0]?.name || "unité"
        const defaultPrice = Number(ingredient.units?.[0]?.price) || 0
        const newIngredient = {
          ...ingredient,
          quantity: 1,
          selectedUnit: defaultUnit,
          unitPrice: defaultPrice,
          total: defaultPrice,
        }
        newSelected.push(newIngredient)
      }
    })
    setSelectedIngredients((prev) => [...prev, ...newSelected])
    toast.success(`Ingrédients du label ajoutés`)
  }

  const updateSelectedIngredient = (id, field, value) => {
    setSelectedIngredients((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value }

          // Assurer que quantity et unitPrice sont des nombres
          if (field === "quantity") {
            updated.quantity = Number(value) || 0
          }
          if (field === "unitPrice") {
            updated.unitPrice = Number(value) || 0
          }

          // Recalculer le total
          if (field === "quantity" || field === "unitPrice") {
            updated.total = (updated.quantity || 0) * (updated.unitPrice || 0)
          }

          if (field === "selectedUnit") {
            const unit = item.units?.find((u) => u.name === value)
            updated.unitPrice = Number(unit?.price) || 0
            updated.total = (updated.quantity || 0) * (updated.unitPrice || 0)
          }

          // Mettre à jour le modal si c'est l'ingrédient actuel
          if (modalIngredient && modalIngredient.id === id) {
            setModalIngredient(updated)
          }

          return updated
        }
        return item
      }),
    )
  }

  const removeSelectedIngredient = (id) => {
    setSelectedIngredients((prev) => prev.filter((item) => item.id !== id))
    toast.info("Ingrédient supprimé")
  }

  const createNewIngredient = async () => {
    const newErrors = {}
    if (!newIngredientForm.name.trim()) newErrors.name = true
    if (!newIngredientForm.unit.trim()) newErrors.unit = true
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) {
      toast.error("Veuillez remplir les champs requis")
      return
    }

    try {
      setIsSubmitting(true)
      const units = [{ name: newIngredientForm.unit, price: newIngredientForm.unitPrice }]
      const ingredientData = {
        name: newIngredientForm.name.trim(),
        labelId: newIngredientForm.labelId || "",
        units,
        menus: [],
        restaurantId: currentRestaurantId,
        createdAt: serverTimestamp(),
      }

      const ref = await addDoc(collection(db, "ingredients"), ingredientData)
      const newIngredient = { id: ref.id, ...ingredientData, units }
      setIngredients((prev) => [...prev, newIngredient])
      toast.success("Ingrédient ajouté avec succès")

      // Optionally select the new ingredient
      const selectedNew = {
        ...newIngredient,
        quantity: 1,
        selectedUnit: newIngredientForm.unit,
        unitPrice: newIngredientForm.unitPrice,
        total: newIngredientForm.unitPrice,
      }
      setSelectedIngredients((prev) => [...prev, selectedNew])
      setModalIngredient(selectedNew)

      setShowAddIngredientModal(false)
      setNewIngredientForm({
        name: "",
        labelId: "",
        unit: "",
        unitPrice: 0,
      })
    } catch (error) {
      console.error("Erreur ajout ingrédient:", error)
      toast.error("Erreur lors de l'ajout de l'ingrédient")
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredIngredients = ingredients.filter((ingredient) => {
    const matchesSearch = ingredient.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesLabel = !selectedLabel || ingredient.labelId === selectedLabel
    return matchesSearch && matchesLabel
  })

  const totalAmount = selectedIngredients.reduce((sum, item) => sum + item.total, 0)
  const newTotal = currentSpent + totalAmount
  const budgetExceeded = newTotal > monthlyBudget
  const budgetWarning = newTotal > monthlyBudget * 0.8

  const savePurchaseList = async () => {
    const newErrors = {}
    if (purchaseInfo.brands.length === 0) newErrors.brands = true
    if (selectedIngredients.length === 0) newErrors.ingredients = true
    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      toast.error("Veuillez remplir tous les champs requis")
      return
    }

    if (budgetExceeded) {
      if (!window.confirm("Budget dépassé ! Continuer ?")) {
        return
      }
    } else if (budgetWarning) {
      if (!window.confirm("Attention, vous approchez du budget ! Continuer ?")) {
        return
      }
    }

    setIsSubmitting(true)
    try {
      const purchaseData = {
        ...purchaseInfo,
        items: selectedIngredients.map((item) => ({
          ingredientId: item.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.selectedUnit,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        total: totalAmount,
        restaurantId: currentRestaurantId,
        status: purchaseInfo.type === "completed" ? "approved" : "pending",
        createdAt: serverTimestamp(),
        ...(purchaseInfo.type === "completed" && {
          approvedAt: serverTimestamp(),
          approvedBy: "system" // Auto-approuvé pour les achats effectués
        })
      }

      await addDoc(collection(db, "purchaseLists"), purchaseData)
      
      if (purchaseInfo.type === "completed") {
        toast.success("Achat effectué enregistré avec succès !")
      } else {
        toast.success("Demande d'achat créée avec succès !")
      }
      
      onSave()
      onClose()
    } catch (error) {
      console.error("Erreur sauvegarde:", error)
      toast.error("Erreur lors de la sauvegarde")
    } finally {
      setIsSubmitting(false)
    }
  }

  const groupedIngredients = alphabet.reduce((acc, letter) => {
    acc[letter] = filteredIngredients.filter((ing) => ing.name.charAt(0).toUpperCase() === letter)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90] flex items-end sm:items-center sm:justify-center sm:p-4">
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white w-full h-32 sm:h-auto sm:w-auto sm:rounded-2xl rounded-t-3xl p-8 shadow-2xl flex items-center justify-center"
        >
          <div className="flex items-center justify-center space-x-3">
            <FaShoppingCart className="animate-spin h-6 w-6 text-blue-600" />
            <span className="text-gray-800 font-medium">Chargement...</span>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end sm:items-center sm:justify-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-white w-full h-[95vh] sm:h-auto sm:max-h-[90vh] sm:max-w-6xl sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Drag handle pour mobile - Plus visible sur grand bottomsheet */}
        <div 
          className="flex justify-center pt-4 pb-2 sm:hidden cursor-grab active:cursor-grabbing bg-gray-50/50"
          onTouchStart={(e) => {
            const touch = e.touches[0];
            setDragY(touch.clientY);
          }}
          onTouchMove={(e) => {
            const touch = e.touches[0];
            const deltaY = touch.clientY - dragY;
            if (deltaY > 0) {
              e.currentTarget.parentElement.style.transform = `translateY(${Math.min(deltaY, 100)}px)`;
            }
          }}
          onTouchEnd={(e) => {
            const deltaY = e.changedTouches[0].clientY - dragY;
            e.currentTarget.parentElement.style.transform = '';
            if (deltaY > 100) {
              handleClose();
            }
            setDragY(0);
          }}
        >
          <div className="w-16 h-1.5 bg-gray-400 rounded-full transition-colors hover:bg-gray-500"></div>
        </div>
        
        <div className="flex justify-between items-center p-4 lg:p-6 border-b border-gray-200 bg-white/50 backdrop-blur-sm">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg lg:text-xl font-semibold text-gray-800">Nouvelle Liste d'Achat</h2>
            <div className="hidden sm:flex items-center space-x-2">
              {[1, 2, 3].map((num) => (
                <div
                  key={num}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200 ${
                    step >= num ? "bg-blue-600 text-white shadow-lg" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {num}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Fermer"
          >
            <FaTimes size={18} />
          </button>
        </div>

        <div className="sm:hidden px-4 py-2 bg-gray-100/30">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Étape {step} sur 3</span>
            <div className="flex space-x-1">
              {[1, 2, 3].map((num) => (
                <div
                  key={num}
                  className={`w-2 h-2 rounded-full transition-colors ${step >= num ? "bg-blue-600" : "bg-gray-100"}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-4 lg:p-6 space-y-6 h-full overflow-y-auto"
              >
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-gray-800">Informations de la Liste</h3>
                  <p className="text-sm text-gray-500">Configurez les détails de votre commande</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-gray-100/30 rounded-lg p-4 border border-gray-200">
                    <label htmlFor="purchase-date" className="block text-sm font-medium text-gray-800 mb-2">
                      Date de commande <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="purchase-date"
                      type="date"
                      value={purchaseInfo.date}
                      onChange={(e) => setPurchaseInfo({ ...purchaseInfo, date: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-gray-800"
                      aria-required="true"
                    />
                  </div>

                  <div className="bg-gray-100/30 rounded-lg p-4 border border-gray-200">
                    <label className="block text-sm font-medium text-gray-800 mb-3">
                      Type d'achat <span className="text-red-600">*</span>
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="purchase-type"
                          value="completed"
                          checked={purchaseInfo.type === "completed"}
                          onChange={(e) => setPurchaseInfo({ ...purchaseInfo, type: e.target.value })}
                          className="h-4 w-4 text-green-600 focus:ring-green-600 border-gray-200"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-800">Achat effectué</span>
                          <p className="text-xs text-gray-500">Les produits ont déjà été achetés</p>
                        </div>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="purchase-type"
                          value="request"
                          checked={purchaseInfo.type === "request"}
                          onChange={(e) => setPurchaseInfo({ ...purchaseInfo, type: e.target.value })}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-600 border-gray-200"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-800">Demande d'achat</span>
                          <p className="text-xs text-gray-500">Liste pour approbation future</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  <div className="bg-gray-100/30 rounded-lg p-4 border border-gray-200">
                    <label className="block text-sm font-medium text-gray-800 mb-3">
                      Marques concernées <span className="text-red-600">*</span>
                    </label>
                    <div className="space-y-3">
                      {brands.map((brand) => (
                        <label key={brand} className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={purchaseInfo.brands.includes(brand)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPurchaseInfo({
                                  ...purchaseInfo,
                                  brands: [...purchaseInfo.brands, brand],
                                })
                              } else {
                                setPurchaseInfo({
                                  ...purchaseInfo,
                                  brands: purchaseInfo.brands.filter((b) => b !== brand),
                                })
                              }
                              setErrors((prev) => ({ ...prev, brands: false }))
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-600 border-gray-200 rounded"
                          />
                          <span className="text-sm text-gray-800">{brand}</span>
                        </label>
                      ))}
                    </div>
                    {errors.brands && (
                      <p className="text-sm text-red-600 mt-2">Sélectionnez au moins une marque.</p>
                    )}
                  </div>
                </div>

                <div className="bg-gray-100/30 rounded-lg p-4 border border-gray-200">
                  <label htmlFor="purchase-notes" className="block text-sm font-medium text-gray-800 mb-2">
                    Notes supplémentaires
                  </label>
                  <textarea
                    id="purchase-notes"
                    value={purchaseInfo.notes}
                    onChange={(e) => setPurchaseInfo({ ...purchaseInfo, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-gray-800 resize-none"
                    rows="4"
                    placeholder="Ajoutez des notes pour cette commande..."
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                {/* Header de recherche - Ultra compact pour maximiser l'espace de sélection */}
                <div className="p-2 sm:p-3 border-b border-gray-200 bg-gray-50/30 flex-shrink-0">
                  <div className="flex gap-2">
                    {/* Barre de recherche compacte */}
                    <div className="relative flex-1">
                      <FaSearch className="absolute top-2 left-2 text-gray-500 text-xs" />
                      <input
                        type="text"
                        placeholder="Rechercher..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 text-sm"
                        aria-label="Rechercher un ingrédient"
                      />
                    </div>
                    
                    {/* Filtre par label - Très compact */}
                    <select
                      value={selectedLabel}
                      onChange={(e) => setSelectedLabel(e.target.value)}
                      className="px-2 py-1.5 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 text-sm min-w-[100px]"
                      aria-label="Filtrer par label"
                    >
                      <option value="">Tous</option>
                      {labels.map((label) => (
                        <option key={label.id} value={label.id}>
                          {label.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Boutons labels - Masqués sur mobile, compacts sur desktop */}
                  <div className="hidden lg:flex flex-wrap gap-1 mt-2">
                    {labels.slice(0, 3).map((label) => (
                      <button
                        key={label.id}
                        onClick={() => addIngredientsByLabel(label.id)}
                        className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition-colors"
                      >
                        + {label.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Liste des ingrédients - Optimisée pour mobile */}
                <div className="flex-1 overflow-hidden relative">
                  {/* Indicateur de scroll pour mobile */}
                  <div className="sm:hidden absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-200 to-blue-400 z-30"></div>
                  
                  <div 
                    className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                    style={{ 
                      maxHeight: 'calc(95vh - 140px)', // Hauteur encore plus grande grâce au header compact
                      minHeight: '550px' // Hauteur minimum encore augmentée
                    }}
                  >
                    <div className="px-3 sm:px-4 lg:px-6">
                      {alphabet.map((letter) => (
                        <div
                          key={letter}
                          className="border-b border-gray-200/30 last:border-b-0"
                        >
                          {groupedIngredients[letter].length > 0 && (
                            <>
                              {/* Header de lettre - Plus compact */}
                              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200/50">
                                <h3 className="px-3 py-2 text-lg font-bold text-gray-700 bg-gradient-to-r from-blue-50 to-transparent">
                                  {letter}
                                </h3>
                              </div>
                              
                              {/* Items d'ingrédients - Optimisés pour mobile */}
                              {groupedIngredients[letter].map((ingredient) => {
                                const isSelected = selectedIngredients.find((sel) => sel.id === ingredient.id)
                                return (
                                  <div
                                    key={ingredient.id}
                                    className={`p-3 sm:p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 flex items-center space-x-3 transition-all duration-200 border-l-4 ${
                                      isSelected 
                                        ? "bg-blue-50 border-blue-500 shadow-sm" 
                                        : "border-transparent hover:border-gray-200"
                                    }`}
                                    onClick={() => toggleIngredient(ingredient)}
                                    role="button"
                                    aria-label={`Sélectionner ou modifier ${ingredient.name}`}
                                  >
                                    {/* Avatar plus grand sur mobile */}
                                    <div className={`w-12 h-12 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-white ${
                                      isSelected ? 'bg-blue-500' : 'bg-gray-400'
                                    }`}>
                                      {ingredient.name.charAt(0).toUpperCase()}
                                    </div>
                                    
                                    {/* Contenu - Mieux espacé */}
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-semibold text-gray-900 text-base sm:text-sm mb-1 leading-tight">
                                        {ingredient.name}
                                      </h4>
                                      <p className="text-sm text-gray-600 mb-1">
                                        {labels.find((l) => l.id === ingredient.labelId)?.name || "Sans label"}
                                      </p>
                                      <p className="text-xs text-gray-500 leading-relaxed">
                                        Unités: {ingredient.units?.map((u) => u.name).join(", ") || "Aucune"}
                                      </p>
                                    </div>
                                    
                                    {/* Indicateur de sélection plus visible */}
                                    <div className="flex-shrink-0">
                                      {isSelected ? (
                                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                                          <FaCheck className="text-white text-sm" />
                                        </div>
                                      ) : (
                                        <div className="w-8 h-8 border-2 border-gray-300 rounded-full flex items-center justify-center">
                                          <FaPlus className="text-gray-400 text-sm" />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-6 space-y-8 h-full overflow-y-auto"
              >
                {/* Header simplifié */}
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                    <FaCheck className="text-2xl text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    {purchaseInfo.type === "completed" ? "Résumé de l'achat effectué" : "Résumé de la demande d'achat"}
                  </h3>
                  <p className="text-lg text-gray-700">
                    {purchaseInfo.type === "completed" ? "Vérifiez avant d'enregistrer" : "Vérifiez avant d'envoyer la demande"}
                  </p>
                </div>

                {/* Alerte Budget - Visible mais équilibrée */}
                {budgetExceeded && (
                  <div className="bg-red-100 border-l-4 border-red-500 rounded-lg p-6 text-center">
                    <FaExclamationTriangle className="text-3xl text-red-600 mx-auto mb-3" />
                    <h4 className="text-xl font-bold text-red-800 mb-2">Attention !</h4>
                    <p className="text-base text-red-700 mb-3">Vous dépassez votre budget</p>
                    <div className="bg-white rounded-lg p-3">
                      <p className="text-lg font-bold text-red-800">
                        {newTotal.toLocaleString()} FCFA {'>'} {monthlyBudget.toLocaleString()} FCFA
                      </p>
                    </div>
                  </div>
                )}

                {budgetWarning && !budgetExceeded && (
                  <div className="bg-orange-100 border-l-4 border-orange-500 rounded-lg p-6 text-center">
                    <FaExclamationTriangle className="text-3xl text-orange-600 mx-auto mb-3" />
                    <h4 className="text-xl font-bold text-orange-800 mb-2">Attention au budget</h4>
                    <p className="text-base text-orange-700">Vous approchez de votre limite</p>
                  </div>
                )}

                {/* TOTAL PRINCIPAL - Bien visible */}
                <div className="bg-blue-100 border-2 border-blue-500 rounded-xl p-6 text-center">
                  <p className="text-lg font-bold text-blue-800 mb-2">Total à payer</p>
                  <p className="text-4xl font-bold text-blue-900 mb-2">{totalAmount.toLocaleString()}</p>
                  <p className="text-xl font-bold text-blue-800">FCFA</p>
                </div>

                {/* Informations essentielles */}
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-300">
                  <h4 className="text-lg font-bold text-gray-900 mb-4 text-center">Informations</h4>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-300">
                      <span className="text-base font-semibold text-gray-700">Type :</span>
                      <span className={`text-base font-bold px-2 py-1 rounded ${
                        purchaseInfo.type === "completed" 
                          ? "bg-green-100 text-green-800" 
                          : "bg-blue-100 text-blue-800"
                      }`}>
                        {purchaseInfo.type === "completed" ? "Achat effectué" : "Demande d'achat"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-2 border-b border-gray-300">
                      <span className="text-base font-semibold text-gray-700">Date :</span>
                      <span className="text-base font-bold text-gray-900">{purchaseInfo.date}</span>
                    </div>
                    
                    <div className="flex justify-between items-center py-2 border-b border-gray-300">
                      <span className="text-base font-semibold text-gray-700">Marques :</span>
                      <span className="text-base font-bold text-gray-900">{purchaseInfo.brands.join(", ") || "Aucune"}</span>
                    </div>
                    
                    <div className="flex justify-between items-center py-2 border-b border-gray-300">
                      <span className="text-base font-semibold text-gray-700">Articles :</span>
                      <span className="text-base font-bold text-gray-900">{selectedIngredients.length} produits</span>
                    </div>
                    
                    {purchaseInfo.notes && (
                      <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mt-3">
                        <p className="text-sm font-semibold text-gray-700 mb-1">Notes :</p>
                        <p className="text-sm text-gray-900">{purchaseInfo.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Liste des produits - Simplifiée */}
                <div className="bg-white rounded-xl border border-gray-300 overflow-hidden">
                  <div className="bg-green-100 p-4 border-b border-gray-300">
                    <div className="flex justify-between items-center">
                      <h4 className="text-lg font-bold text-gray-900">Liste des produits</h4>
                      <button
                        onClick={() => setStep(2)}
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-600 transition-colors"
                      >
                        Modifier
                      </button>
                    </div>
                  </div>

                  <div className="p-4">
                    {/* Liste simplifiée pour tous les écrans */}
                    <div className="space-y-3">
                      {selectedIngredients.map((item, index) => (
                        <div 
                          key={item.id}
                          className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <h5 className="text-lg font-bold text-gray-900">{item.name}</h5>
                            <span className="text-xl font-bold text-green-600">{item.total.toLocaleString()} FCFA</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mt-3">
                            <div className="bg-white rounded-lg p-3 border border-gray-300">
                              <p className="text-xs font-semibold text-gray-600 mb-1">QUANTITÉ</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-xl font-bold text-blue-600">({item.quantity})</span>
                                <span className="text-sm font-medium text-gray-700">{item.selectedUnit}</span>
                              </div>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-gray-300">
                              <p className="text-xs font-semibold text-gray-600 mb-1">PRIX UNITAIRE</p>
                              <p className="text-base font-bold text-green-600">{item.unitPrice.toLocaleString()} FCFA</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Total final - Bien visible */}
                  <div className="bg-green-100 p-4 border-t-2 border-green-500">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900">Total général :</span>
                      <span className="text-2xl font-bold text-green-700">{totalAmount.toLocaleString()} FCFA</span>
                    </div>
                  </div>
                </div>

                {/* Budget restant - Information importante */}
                <div className="bg-yellow-50 border border-yellow-400 rounded-xl p-5">
                  <h4 className="text-lg font-bold text-gray-900 mb-4 text-center">Budget du mois</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700">Déjà dépensé</p>
                      <p className="text-xl font-bold text-red-600">{currentSpent.toLocaleString()} FCFA</p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700">Après cette commande</p>
                      <p className="text-xl font-bold text-blue-600">{newTotal.toLocaleString()} FCFA</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 text-center">
                    <p className="text-sm font-semibold text-gray-700">Budget total du mois</p>
                    <p className="text-2xl font-bold text-gray-900">{monthlyBudget.toLocaleString()} FCFA</p>
                  </div>
                  
                  {/* Barre de progression simplifiée */}
                  <div className="mt-4">
                    <div className="bg-gray-300 rounded-full h-4">
                      <div 
                        className={`h-4 rounded-full transition-all duration-300 ${
                          budgetExceeded ? 'bg-red-500' : 
                          budgetWarning ? 'bg-orange-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min((newTotal / monthlyBudget) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-center text-base font-bold mt-2 text-gray-900">
                      {Math.round((newTotal / monthlyBudget) * 100)}% du budget utilisé
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {step === 2 && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={() => setShowAddIngredientModal(true)}
            className="absolute bottom-20 right-4 sm:fixed sm:bottom-24 sm:right-6 bg-blue-600 text-white rounded-full p-3 sm:p-4 shadow-lg hover:bg-blue-600/90 transition-all duration-200 z-40"
            aria-label="Ajouter un nouvel ingrédient"
          >
            <FaPlus size={16} className="sm:w-5 sm:h-5" />
          </motion.button>
        )}

        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg">
          {/* Indicateur de sélection pour mobile sur étape 2 */}
          {step === 2 && (
            <div className="sm:hidden bg-blue-50 px-4 py-2 border-b border-blue-200">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{selectedIngredients.length}</span>
                  </div>
                  <span className="text-sm font-medium text-blue-800">
                    {selectedIngredients.length === 0 
                      ? "Aucun ingrédient sélectionné" 
                      : `${selectedIngredients.length} ingrédient${selectedIngredients.length > 1 ? 's' : ''} sélectionné${selectedIngredients.length > 1 ? 's' : ''}`
                    }
                  </span>
                </div>
                <span className="text-lg font-bold text-blue-600">
                  {totalAmount.toLocaleString()} FCFA
                </span>
              </div>
            </div>
          )}
          
          <div className="p-3 sm:p-4 lg:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex-1">
              {step === 2 && (
                <div className="hidden sm:block">
                  <p className="text-sm text-gray-500">
                    Total sélectionné:{" "}
                    <span className="font-semibold text-gray-800">{totalAmount.toLocaleString()} FCFA</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {selectedIngredients.length} ingrédient{selectedIngredients.length > 1 ? 's' : ''} sélectionné{selectedIngredients.length > 1 ? 's' : ''}
                  </p>
                </div>
              )}
              {errors.ingredients && <p className="text-sm text-red-600">Ajoutez au moins un ingrédient.</p>}
            </div>

            <div className="flex space-x-3 w-full sm:w-auto">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 sm:flex-none px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-gray-800 flex items-center justify-center space-x-2"
                aria-label="Retour"
              >
                <FaChevronLeft size={14} />
                <span>Précédent</span>
              </button>
            )}

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && purchaseInfo.brands.length === 0}
                className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-600/90 disabled:opacity-50 transition-colors flex items-center justify-center space-x-2"
                aria-label="Suivant"
              >
                <span>Suivant</span>
                <FaChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={savePurchaseList}
                disabled={selectedIngredients.length === 0 || isSubmitting}
                className="flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-600/90 disabled:opacity-50 transition-colors flex items-center justify-center space-x-2"
                aria-label="Enregistrer la liste"
              >
                {isSubmitting ? (
                  <>
                    <FaShoppingCart className="animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <FaShoppingCart />
                    <span>Enregistrer</span>
                  </>
                )}
              </button>
            )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Add New Ingredient Modal */}
      <AnimatePresence>
        {showAddIngredientModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center sm:justify-center z-[110] sm:p-4"
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-3xl p-6 shadow-2xl border-t border-gray-200 sm:border max-h-[90vh] overflow-y-auto"
            >
              {/* Drag handle pour mobile */}
              <div className="flex justify-center -mt-3 mb-3 sm:hidden">
                <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
              </div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-800">Ajouter un nouvel ingrédient</h3>
                <button
                  onClick={() => setShowAddIngredientModal(false)}
                  className="text-gray-500 hover:text-gray-800 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Fermer la modale"
                >
                  <FaTimes size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="new-name" className="block text-sm font-medium text-gray-800 mb-2">
                    Nom <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="new-name"
                    type="text"
                    value={newIngredientForm.name}
                    onChange={(e) => setNewIngredientForm({ ...newIngredientForm, name: e.target.value })}
                    className={`w-full px-3 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-gray-800 ${
                      errors.name ? "border-red-600" : "border-gray-200"
                    }`}
                    aria-required="true"
                  />
                  {errors.name && <p className="text-sm text-red-600 mt-1">Requis</p>}
                </div>

                <div>
                  <label htmlFor="new-label" className="block text-sm font-medium text-gray-800 mb-2">
                    Label
                  </label>
                  <select
                    id="new-label"
                    value={newIngredientForm.labelId}
                    onChange={(e) => setNewIngredientForm({ ...newIngredientForm, labelId: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-gray-800"
                  >
                    <option value="">Sélectionner un label</option>
                    {labels.map((label) => (
                      <option key={label.id} value={label.id}>
                        {label.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="new-unit" className="block text-sm font-medium text-gray-800 mb-2">
                    Unité <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="new-unit"
                    type="text"
                    value={newIngredientForm.unit}
                    onChange={(e) => setNewIngredientForm({ ...newIngredientForm, unit: e.target.value })}
                    className={`w-full px-3 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-gray-800 ${
                      errors.unit ? "border-red-600" : "border-gray-200"
                    }`}
                    placeholder="ex. kg"
                    aria-required="true"
                  />
                  {errors.unit && <p className="text-sm text-red-600 mt-1">Requis</p>}
                </div>

                <div>
                  <label htmlFor="new-unit-price" className="block text-sm font-medium text-gray-800 mb-2">
                    Prix unitaire (FCFA)
                  </label>
                  <input
                    id="new-unit-price"
                    type="number"
                    value={newIngredientForm.unitPrice}
                    onChange={(e) => setNewIngredientForm({ ...newIngredientForm, unitPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-gray-800"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowAddIngredientModal(false)}
                  className="px-4 py-2 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={createNewIngredient}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-600/90 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? "Ajout..." : "Ajouter"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ingredient Modal */}
      <AnimatePresence>
        {modalIngredient && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center sm:justify-center z-[120] sm:p-4"
            onClick={() => setModalIngredient(null)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white w-full sm:max-w-sm sm:rounded-xl rounded-t-3xl p-4 shadow-2xl border-t border-gray-200 sm:border"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle pour mobile */}
              <div className="flex justify-center -mt-2 mb-3 sm:hidden">
                <div className="w-12 h-1 bg-gray-400 rounded-full"></div>
              </div>
              
              {/* Header compact */}
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">{modalIngredient.name}</h3>
                <p className="text-sm text-gray-500">Ajustez la quantité et le prix</p>
              </div>

              {/* Quantité - Interface simplifiée */}
              <div className="mb-4">
                <div className="flex items-center justify-center space-x-4 mb-3">
                  <button
                    onClick={() => {
                      const newQuantity = Math.max(0, modalIngredient.quantity - 1)
                      updateSelectedIngredient(modalIngredient.id, "quantity", newQuantity)
                    }}
                    className="w-12 h-12 bg-red-100 text-red-600 rounded-full hover:bg-red-200 flex items-center justify-center font-bold transition-colors text-xl"
                  >
                    −
                  </button>
                  
                  <div className="text-center">
                    <input
                      type="number"
                      value={modalIngredient.quantity}
                      onChange={(e) => updateSelectedIngredient(modalIngredient.id, "quantity", parseInt(e.target.value, 10) || 0)}
                      className="w-20 text-2xl font-bold text-center border-2 border-blue-200 rounded-lg py-2 focus:outline-none focus:border-blue-500"
                      min="0"
                      step="1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Quantité</p>
                  </div>
                  
                  <button
                    onClick={() => {
                      const newQuantity = modalIngredient.quantity + 1
                      updateSelectedIngredient(modalIngredient.id, "quantity", newQuantity)
                    }}
                    className="w-12 h-12 bg-green-100 text-green-600 rounded-full hover:bg-green-200 flex items-center justify-center font-bold transition-colors text-xl"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Unité et Prix sur une ligne */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unité</label>
                  <select
                    value={modalIngredient.selectedUnit}
                    onChange={(e) => updateSelectedIngredient(modalIngredient.id, "selectedUnit", e.target.value)}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                  >
                    {modalIngredient.units?.map((unit) => (
                      <option key={unit.name} value={unit.name}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Prix/unité</label>
                  <input
                    type="number"
                    value={modalIngredient.unitPrice}
                    onChange={(e) => updateSelectedIngredient(modalIngredient.id, "unitPrice", Number(e.target.value) || 0)}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>

              {/* Total mis en avant */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-4 mb-4 text-center">
                <p className="text-sm text-gray-600 mb-1">Total</p>
                <p className="text-3xl font-bold text-green-600">
                  {modalIngredient.total.toLocaleString()} <span className="text-lg">FCFA</span>
                </p>
              </div>

              {/* Boutons simplifiés */}
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    removeSelectedIngredient(modalIngredient.id)
                    setModalIngredient(null)
                  }}
                  className="flex-1 py-3 text-red-600 border-2 border-red-200 rounded-xl hover:bg-red-50 transition-colors font-medium"
                >
                  Supprimer
                </button>
                <button
                  onClick={() => setModalIngredient(null)}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                >
                  ✓ Valider
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default PurchaseListCreator
