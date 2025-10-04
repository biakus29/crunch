// Shared admin utilities extracted from restaurantadmin.jsx

export const formatPrice = (number) =>
  Number(number).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export const convertPrice = (price) => {
  if (typeof price === "string") {
    return parseFloat(price.replace(/\./g, ""));
  }
  return Number(price);
};

export const calculateTimeDifferenceInMinutes = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate - startDate;
  return Math.floor(diffMs / (1000 * 60));
};

export const calculateOrderTotals = (order, extraLists, items) => {
  const subtotal = order.items.reduce((sum, item) => {
    const currentItem = Array.isArray(items) ? items.find((it) => it.id === item.dishId) : null;
    const itemPrice = item.price !== undefined && !isNaN(convertPrice(item.price))
      ? convertPrice(item.price)
      : item.dishPrice !== undefined && !isNaN(convertPrice(item.dishPrice))
      ? convertPrice(item.dishPrice)
      : currentItem?.price
      ? convertPrice(currentItem.price)
      : 0;
    const extrasTotal = item.selectedExtras
      ? Object.entries(item.selectedExtras).reduce((extraSum, [extraListId, indexes]) => {
          const extraList = extraLists.find((el) => el.id === extraListId)?.extraListElements || [];
          return extraSum + indexes.reduce((acc, index) => acc + Number(extraList[index]?.price || 0), 0);
        }, 0)
      : 0;
    return sum + (itemPrice + extrasTotal) * Number(item.quantity || 1);
  }, 0);
  
  const deliveryFee = order.deliveryFee !== undefined ? Number(order.deliveryFee) : 1000;
  const pointsReduction = Number(order.pointsReduction) || 0;
  const promoDiscount = Number(order.promoDiscount) || 0;
  const pointsDiscount = Number(order.pointsDiscount) || 0;
  const totalDiscount = promoDiscount + pointsDiscount + pointsReduction;
  
  const totalWithDelivery = subtotal + deliveryFee - totalDiscount;
  
  return { 
    subtotal, 
    deliveryFee,
    promoDiscount,
    pointsDiscount,
    pointsReduction, 
    totalDiscount,
    totalWithDelivery,
    finalTotal: totalWithDelivery
  };
};

export const getWeekNumber = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
};
