import React from 'react';
import Canvas from './components/Canvas';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4">
          <h1 className="text-2xl font-bold text-gray-800">Polygon Drawing App</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto">
        <Canvas />
      </main>
    </div>
  );
}

export default App;