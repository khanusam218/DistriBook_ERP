function Placeholder({ title }) {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">{title}</h1>
      <div className="bg-blue-50 p-8 rounded-lg border border-blue-200">
        <p className="text-gray-600">This module is ready to be implemented with full CRUD operations.</p>
        <p className="text-sm text-gray-500 mt-4">API endpoints available at: /api/{title.toLowerCase().replace(' ', '-')}</p>
      </div>
    </div>
  )
}

export default Placeholder
