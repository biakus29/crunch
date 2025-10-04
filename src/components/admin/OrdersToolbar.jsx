import React from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

const OrdersToolbar = React.memo(function OrdersToolbar({
  dateFilterMode,
  setDateFilterMode,
  selectedDate,
  setSelectedDate,
  handlePreviousPeriod,
  handleNextPeriod,
  getWeekNumber,
}) {
  const safeDate = selectedDate instanceof Date ? selectedDate : new Date();
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <div className="flex items-center bg-white rounded-lg shadow-sm p-2">
        <button
          className={`px-3 py-1 rounded-md ${
            dateFilterMode === "day" ? "bg-green-100 text-green-700" : "text-gray-600"
          }`}
          onClick={() => setDateFilterMode("day")}
        >
          Jour
        </button>
        <button
          className={`px-3 py-1 rounded-md ${
            dateFilterMode === "week" ? "bg-green-100 text-green-700" : "text-gray-600"
          }`}
          onClick={() => setDateFilterMode("week")}
        >
          Semaine
        </button>
        <button
          className={`px-3 py-1 rounded-md ${
            dateFilterMode === "month" ? "bg-green-100 text-green-700" : "text-gray-600"
          }`}
          onClick={() => setDateFilterMode("month")}
        >
          Mois
        </button>
      </div>

      <div className="flex items-center bg-white rounded-lg shadow-sm p-1">
        <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-md" onClick={handlePreviousPeriod}>
          <FaChevronLeft />
        </button>
        <div className="px-3 py-1 text-sm font-medium">
          {dateFilterMode === "day"
            ? safeDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
            : dateFilterMode === "week"
            ? `Semaine ${getWeekNumber ? getWeekNumber(safeDate) : ""}`
            : safeDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
        </div>
        <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-md" onClick={handleNextPeriod}>
          <FaChevronRight />
        </button>
      </div>
    </div>
  );
});

export default OrdersToolbar;

