"use client";

import { useState } from "react";
import { StatCard } from "@/components/StatCard";

// TODO: Replace placeholder data with live on-chain queries
const MOCK_ACTIVITY = [
  { id: 1, action: "Mint", amount: "50,000", address: "7xKp...3fGh", time: "2 min ago" },
  { id: 2, action: "Burn", amount: "10,000", address: "9aLm...8wQr", time: "15 min ago" },
  { id: 3, action: "Freeze", amount: "--", address: "3bNx...6vTs", time: "1 hr ago" },
  { id: 4, action: "Transfer", amount: "25,000", address: "5cRy...2kJp", time: "2 hr ago" },
  { id: 5, action: "Mint", amount: "100,000", address: "8dWz...4mFn", time: "3 hr ago" },
];

export default function DashboardPage() {
  const [mintAmount, setMintAmount] = useState("");
  const [burnAmount, setBurnAmount] = useState("");
  const [freezeAddress, setFreezeAddress] = useState("");
  const [thawAddress, setThawAddress] = useState("");

  // TODO: Wire up to on-chain program via Anchor
  const handleMint = () => {
    console.log("Mint:", mintAmount);
    setMintAmount("");
  };

  const handleBurn = () => {
    console.log("Burn:", burnAmount);
    setBurnAmount("");
  };

  const handleFreeze = () => {
    console.log("Freeze:", freezeAddress);
    setFreezeAddress("");
  };

  const handleThaw = () => {
    console.log("Thaw:", thawAddress);
    setThawAddress("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Solana Stablecoin Standard
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Admin dashboard for stablecoin management
        </p>
      </div>

      {/* Stats Row */}
      {/* TODO: Fetch live stats from on-chain config and mint accounts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Supply"
          value="1,000,000"
          subtitle="USDS tokens"
          color="indigo"
        />
        <StatCard
          title="Total Minted"
          value="1,250,000"
          subtitle="All time"
          color="green"
        />
        <StatCard
          title="Total Burned"
          value="250,000"
          subtitle="All time"
          color="red"
        />
        <StatCard
          title="Status"
          value="Active"
          subtitle="Protocol is live"
          color="green"
        />
      </div>

      {/* Management Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Supply Management */}
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold text-white">
            Supply Management
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Mint new tokens or burn existing supply
          </p>

          <div className="mt-6 space-y-4">
            {/* Mint Form */}
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Mint Tokens
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  placeholder="Amount"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                  className="flex-1 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={handleMint}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
                >
                  Mint
                </button>
              </div>
            </div>

            {/* Burn Form */}
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Burn Tokens
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  placeholder="Amount"
                  value={burnAmount}
                  onChange={(e) => setBurnAmount(e.target.value)}
                  className="flex-1 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <button
                  onClick={handleBurn}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
                >
                  Burn
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Account Management */}
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold text-white">
            Account Management
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Freeze or thaw token accounts
          </p>

          <div className="mt-6 space-y-4">
            {/* Freeze Form */}
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Freeze Account
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  placeholder="Wallet address"
                  value={freezeAddress}
                  onChange={(e) => setFreezeAddress(e.target.value)}
                  className="flex-1 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                />
                <button
                  onClick={handleFreeze}
                  className="rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-yellow-500"
                >
                  Freeze
                </button>
              </div>
            </div>

            {/* Thaw Form */}
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Thaw Account
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  placeholder="Wallet address"
                  value={thawAddress}
                  onChange={(e) => setThawAddress(e.target.value)}
                  className="flex-1 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <button
                  onClick={handleThaw}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500"
                >
                  Thaw
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {/* TODO: Fetch real transaction history from on-chain or indexer */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
        <p className="mt-1 text-sm text-gray-400">
          Latest protocol transactions
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="pb-3 pr-4 font-medium">Action</th>
                <th className="pb-3 pr-4 font-medium">Amount</th>
                <th className="pb-3 pr-4 font-medium">Address</th>
                <th className="pb-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {MOCK_ACTIVITY.map((item) => (
                <tr key={item.id} className="text-gray-300">
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        item.action === "Mint"
                          ? "bg-green-900/50 text-green-400"
                          : item.action === "Burn"
                            ? "bg-red-900/50 text-red-400"
                            : item.action === "Freeze"
                              ? "bg-yellow-900/50 text-yellow-400"
                              : "bg-blue-900/50 text-blue-400"
                      }`}
                    >
                      {item.action}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-mono">{item.amount}</td>
                  <td className="py-3 pr-4 font-mono text-gray-500">
                    {item.address}
                  </td>
                  <td className="py-3 text-gray-500">{item.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
