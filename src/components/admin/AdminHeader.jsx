import React from "react";

const AdminHeader = React.memo(function AdminHeader({ title, description, children }) {
  return (
    <div className="mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
          <p className="text-gray-600 mt-1">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
});

export default AdminHeader;
