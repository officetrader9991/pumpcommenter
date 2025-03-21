'use client';

import { useState, useEffect } from 'react';

interface Commenter {
  username: string;
  profileLink: string;
  wallet: string | null;
  isDev?: boolean;
  commentCount: number;
  tokenBalance: number | null;
  isLoadingBalance: boolean;
}

interface CommenterListProps {
  commenters: Commenter[];
  onAirdrop: (selectedWallets: string[]) => void;
  isAirdropping: boolean;
  checkBalances: (walletAddresses: string[], showLoadingState?: boolean) => Promise<void>;
  tokenMint: string;
}

export default function CommenterList({ 
  commenters, 
  onAirdrop,
  isAirdropping,
  checkBalances,
  tokenMint
}: CommenterListProps) {
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [useBalanceFilter, setUseBalanceFilter] = useState(false);
  const [balanceThreshold, setBalanceThreshold] = useState<number>(0);
  const [balanceFilterType, setBalanceFilterType] = useState<'greater' | 'less' | 'equal'>('greater');

  // Filter out commenters with no wallet address
  const validCommenters = commenters.filter(commenter => commenter.wallet);

  // Get commenters that match the balance filter criteria
  const getBalanceFilteredCommenters = () => {
    if (!useBalanceFilter) return validCommenters;
    
    return validCommenters.filter(commenter => {
      // Skip if balance is not checked yet
      if (commenter.tokenBalance === null) return false;
      
      switch(balanceFilterType) {
        case 'greater':
          return commenter.tokenBalance >= balanceThreshold;
        case 'less':
          return commenter.tokenBalance < balanceThreshold;
        case 'equal':
          return commenter.tokenBalance === balanceThreshold;
        default:
          return true;
      }
    });
  };

  const filteredCommenters = getBalanceFilteredCommenters();

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedWallets([]);
    } else {
      const walletsToSelect = filteredCommenters
        .map(commenter => commenter.wallet)
        .filter((wallet): wallet is string => wallet !== null);
      setSelectedWallets(walletsToSelect);
    }
    setSelectAll(!selectAll);
  };

  const handleToggleWallet = (wallet: string) => {
    setSelectedWallets(prev => 
      prev.includes(wallet)
        ? prev.filter(w => w !== wallet)
        : [...prev, wallet]
    );
  };

  const handleAirdrop = () => {
    if (selectedWallets.length > 0) {
      onAirdrop(selectedWallets);
    }
  };

  const handleCheckAllBalances = () => {
    checkBalances([]);
  };

  const handleCheckSingleBalance = (wallet: string) => {
    if (wallet) {
      checkBalances([wallet]);
    }
  };

  // Apply balance filter to select wallets
  const applyBalanceFilter = () => {
    // First make sure balances are checked
    if (validCommenters.some(c => c.tokenBalance === null)) {
      checkBalances([]).then(() => {
        // After balances are checked, update the selected wallets
        const walletsToSelect = getBalanceFilteredCommenters()
          .map(commenter => commenter.wallet)
          .filter((wallet): wallet is string => wallet !== null);
        setSelectedWallets(walletsToSelect);
        setSelectAll(walletsToSelect.length > 0);
      });
    } else {
      // If balances are already checked, just update selected wallets
      const walletsToSelect = getBalanceFilteredCommenters()
        .map(commenter => commenter.wallet)
        .filter((wallet): wallet is string => wallet !== null);
      setSelectedWallets(walletsToSelect);
      setSelectAll(walletsToSelect.length > 0);
    }
  };

  // Effect to update selections when filter changes
  useEffect(() => {
    if (useBalanceFilter) {
      applyBalanceFilter();
    }
  }, [useBalanceFilter, balanceThreshold, balanceFilterType]);

  if (commenters.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex flex-col space-y-4 mb-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">Commenters Found: {commenters.length}</h2>
            <button
              onClick={handleCheckAllBalances}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Check All Balances
            </button>
          </div>
          
          <div className="flex flex-col space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useBalanceFilter}
                  onChange={(e) => setUseBalanceFilter(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-blue-600"
                />
                <span>Filter by token balance</span>
              </label>
              
              <label className="flex items-center space-x-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  className="form-checkbox h-5 w-5 text-blue-600"
                  disabled={validCommenters.length === 0 || isAirdropping}
                />
                <span>Select {useBalanceFilter ? 'filtered' : 'all valid'}</span>
              </label>
            </div>
            
            {useBalanceFilter && (
              <div className="flex items-center space-x-3">
                <select
                  value={balanceFilterType}
                  onChange={(e) => setBalanceFilterType(e.target.value as 'greater' | 'less' | 'equal')}
                  className="p-2 border rounded text-sm"
                >
                  <option value="greater">Greater than or equal to</option>
                  <option value="less">Less than</option>
                  <option value="equal">Equal to</option>
                </select>
                
                <input
                  type="number"
                  value={balanceThreshold}
                  onChange={(e) => setBalanceThreshold(Number(e.target.value))}
                  min="0"
                  step="0.01"
                  className="p-2 border rounded w-32 text-sm"
                  placeholder="Token amount"
                />
                
                <span className="text-xs text-gray-500">
                  {filteredCommenters.length} of {validCommenters.length} wallets match filter
                </span>
              </div>
            )}
            
            <div className="flex justify-end">
              <button
                onClick={handleAirdrop}
                disabled={selectedWallets.length === 0 || isAirdropping}
                className={`bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
                  selectedWallets.length === 0 || isAirdropping ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isAirdropping ? 'Airdropping...' : `Airdrop to ${selectedWallets.length} Selected`}
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Select
                </th>
                <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Username
                </th>
                <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Comments
                </th>
                <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Wallet
                </th>
                <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Token Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {commenters.map((commenter, index) => (
                <tr 
                  key={index} 
                  className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} ${
                    useBalanceFilter && 
                    commenter.wallet && 
                    commenter.tokenBalance !== null && 
                    !filteredCommenters.some(c => c.wallet === commenter.wallet) ? 
                    'opacity-40' : ''
                  }`}
                >
                  <td className="py-2 px-4 border-b border-gray-200">
                    <input
                      type="checkbox"
                      checked={commenter.wallet ? selectedWallets.includes(commenter.wallet) : false}
                      onChange={() => commenter.wallet && handleToggleWallet(commenter.wallet)}
                      disabled={
                        !commenter.wallet || 
                        isAirdropping || 
                        (useBalanceFilter && 
                         commenter.tokenBalance !== null && 
                         !filteredCommenters.some(c => c.wallet === commenter.wallet))
                      }
                      className="form-checkbox h-5 w-5 text-blue-600"
                    />
                  </td>
                  <td className="py-2 px-4 border-b border-gray-200 text-sm">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-900">{commenter.username}</span>
                      {commenter.profileLink && (
                        <a 
                          href={`https://pump.fun${commenter.profileLink}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="ml-2 text-blue-500 hover:text-blue-700"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                          </svg>
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-4 border-b border-gray-200 text-sm">
                    <span className="px-2 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded-full">
                      {commenter.commentCount}
                    </span>
                  </td>
                  <td className="py-2 px-4 border-b border-gray-200 text-sm">
                    {commenter.wallet ? (
                      <span className="px-2 py-1 text-xs text-green-800 bg-green-100 rounded-full">
                        {`${commenter.wallet.slice(0, 6)}...${commenter.wallet.slice(-4)}`}
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs text-red-800 bg-red-100 rounded-full">
                        Not available
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-4 border-b border-gray-200 text-sm">
                    {commenter.wallet ? (
                      <div className="flex items-center space-x-2">
                        {commenter.isLoadingBalance ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        ) : (
                          <>
                            {commenter.tokenBalance !== null ? (
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                commenter.tokenBalance > 0 
                                  ? 'text-green-800 bg-green-100' 
                                  : 'text-gray-800 bg-gray-100'
                              }`}>
                                {commenter.tokenBalance.toLocaleString(undefined, { 
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 4
                                })}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">Not checked</span>
                            )}
                            <button
                              onClick={() => handleCheckSingleBalance(commenter.wallet!)}
                              className="text-blue-500 hover:text-blue-700 focus:outline-none"
                              title="Check balance"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 