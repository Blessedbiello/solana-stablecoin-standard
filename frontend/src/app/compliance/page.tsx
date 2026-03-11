"use client";

import { useState } from "react";

// TODO: Replace with live on-chain blacklist data
const MOCK_BLACKLIST = [
  { address: "7xKp...3fGh", reason: "Sanctions list", addedAt: "2024-01-15" },
  { address: "9aLm...8wQr", reason: "Fraud detection", addedAt: "2024-02-03" },
  { address: "3bNx...6vTs", reason: "Compliance review", addedAt: "2024-03-10" },
];

export default function CompliancePage() {
  const [blacklistAddress, setBlacklistAddress] = useState("");
  const [blacklistReason, setBlacklistReason] = useState("");
  const [removeAddress, setRemoveAddress] = useState("");
  const [seizeAddress, setSeizeAddress] = useState("");
  const [seizeAmount, setSeizeAmount] = useState("");

  // TODO: Wire up to sss-transfer-hook blacklist PDA instructions
  const handleAddToBlacklist = () => {
    console.log("Add to blacklist:", blacklistAddress, blacklistReason);
    setBlacklistAddress("");
    setBlacklistReason("");
  };

  const handleRemoveFromBlacklist = () => {
    console.log("Remove from blacklist:", removeAddress);
    setRemoveAddress("");
  };

  // TODO: Wire up to sss-token seize instruction
  const handleSeize = () => {
    console.log("Seize:", seizeAddress, seizeAmount);
    setSeizeAddress("");
    setSeizeAmount("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Compliance</h1>
        <p className="mt-1 text-sm text-gray-400">
          Manage blacklisted addresses and enforce compliance policies
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Add to Blacklist */}
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold text-white">
            Add to Blacklist
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Block an address from sending or receiving tokens
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Wallet Address
              </label>
              <input
                type="text"
                placeholder="Enter Solana address"
                value={blacklistAddress}
                onChange={(e) => setBlacklistAddress(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Reason
              </label>
              <input
                type="text"
                placeholder="Reason for blacklisting"
                value={blacklistReason}
                onChange={(e) => setBlacklistReason(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <button
              onClick={handleAddToBlacklist}
              className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
            >
              Add to Blacklist
            </button>
          </div>
        </div>

        {/* Remove from Blacklist */}
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold text-white">
            Remove from Blacklist
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Restore transfer privileges for an address
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Wallet Address
              </label>
              <input
                type="text"
                placeholder="Enter Solana address"
                value={removeAddress}
                onChange={(e) => setRemoveAddress(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
            <button
              onClick={handleRemoveFromBlacklist}
              className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500"
            >
              Remove from Blacklist
            </button>
          </div>
        </div>
      </div>

      {/* Seize Tokens */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-lg font-semibold text-white">Seize Tokens</h2>
        <p className="mt-1 text-sm text-gray-400">
          Forcibly transfer tokens from a blacklisted address back to the
          treasury
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-gray-300">
              Address
            </label>
            <input
              type="text"
              placeholder="Target wallet address"
              value={seizeAddress}
              onChange={(e) => setSeizeAddress(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-gray-300">
              Amount
            </label>
            <input
              type="number"
              placeholder="Token amount"
              value={seizeAmount}
              onChange={(e) => setSeizeAmount(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
            />
          </div>
          <div className="flex items-end sm:col-span-1">
            <button
              onClick={handleSeize}
              className="w-full rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-yellow-500"
            >
              Seize Tokens
            </button>
          </div>
        </div>
      </div>

      {/* Blacklisted Addresses Table */}
      {/* TODO: Fetch real blacklist entries from on-chain PDAs */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-lg font-semibold text-white">
          Blacklisted Addresses
        </h2>
        <p className="mt-1 text-sm text-gray-400">
          Currently blocked addresses
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="pb-3 pr-4 font-medium">Address</th>
                <th className="pb-3 pr-4 font-medium">Reason</th>
                <th className="pb-3 pr-4 font-medium">Added</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {MOCK_BLACKLIST.map((entry) => (
                <tr key={entry.address} className="text-gray-300">
                  <td className="py-3 pr-4 font-mono">{entry.address}</td>
                  <td className="py-3 pr-4">{entry.reason}</td>
                  <td className="py-3 pr-4 text-gray-500">{entry.addedAt}</td>
                  <td className="py-3">
                    <button className="text-sm text-red-400 transition-colors hover:text-red-300">
                      Remove
                    </button>
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
