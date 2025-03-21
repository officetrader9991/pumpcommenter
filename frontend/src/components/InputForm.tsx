'use client';

import { useState } from 'react';

interface InputFormProps {
  onSubmit: (url: string, xpath?: string) => void;
  isLoading: boolean;
}

export default function InputForm({ onSubmit, isLoading }: InputFormProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto mb-8">
      <div className="mb-4">
        <label htmlFor="url" className="block text-gray-700 text-sm font-bold mb-2">
          Pump.fun Token URL
        </label>
        <input
          type="text"
          id="url"
          placeholder="https://pump.fun/coin/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          disabled={isLoading}
        />
      </div>
      
      <div className="flex items-center justify-center">
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline ${
            isLoading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? 'Loading...' : 'Get Commenters'}
        </button>
      </div>
    </form>
  );
} 