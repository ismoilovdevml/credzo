"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, EyeOff, Key, AlertTriangle, Check, Copy, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { generateSecureKey, validatePassword } from "@/lib/crypto";

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  mode: "export" | "import";
}

export function PasswordModal({ isOpen, onClose, onConfirm, mode }: PasswordModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [generatedKey, setGeneratedKey] = useState("");
  const [showGenerated, setShowGenerated] = useState(false);
  const [copied, setCopied] = useState(false);

  // Calculate validation on demand instead of storing in state
  const validation = password ? validatePassword(password) : { valid: false, message: "" };

  const handleGenerateKey = () => {
    const key = generateSecureKey();
    setGeneratedKey(key);
    setPassword(key);
    setShowGenerated(true);
    setShowPassword(true);
  };

  const handleCopyKey = async () => {
    await navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = () => {
    if (mode === "export" && !validation.valid) return;
    if (mode === "import" && !password) return;
    onConfirm(password);
    handleClose();
  };

  const handleClose = () => {
    setPassword("");
    setGeneratedKey("");
    setShowGenerated(false);
    setShowPassword(false);
    setCopied(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              {/* Header */}
              <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                <button
                  onClick={handleClose}
                  className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <Key className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black">
                      {mode === "export" ? "Secure Export" : "Decrypt Import"}
                    </h2>
                    <p className="text-blue-100 text-sm">
                      {mode === "export"
                        ? "Encrypt your data with a password"
                        : "Enter password to decrypt data"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Instructions */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl">
                  <div className="flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900 dark:text-blue-300">
                      {mode === "export" ? (
                        <>
                          <p className="font-semibold mb-1">Important:</p>
                          <p>
                            Your data will be encrypted with this password. Save it securely - you&apos;ll
                            need it to import your data later. Without the password, your data cannot be
                            recovered.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold mb-1">Decryption Required:</p>
                          <p>
                            Enter the password you used when exporting this data. The import will fail
                            if the password is incorrect.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {mode === "export" ? "Create Password" : "Enter Password"}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "export" ? "Enter a strong password" : "Enter your password"}
                      className="w-full px-4 py-3 pr-12 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white font-mono"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      )}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {mode === "export" && password && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        {validation.valid ? (
                          <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        )}
                        <span
                          className={`text-xs font-medium ${
                            validation.valid
                              ? "text-green-600 dark:text-green-400"
                              : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {validation.message}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Generate Password Button (Export only) */}
                {mode === "export" && (
                  <div>
                    <Button
                      variant="outline"
                      onClick={handleGenerateKey}
                      className="w-full"
                      type="button"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Generate Secure Password
                    </Button>

                    {/* Generated Password Display */}
                    {showGenerated && generatedKey && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-green-900 dark:text-green-300 mb-1">
                              Secure Password Generated
                            </p>
                            <p className="text-xs text-green-700 dark:text-green-400 mb-2">
                              Copy this password and save it in a secure location. You&apos;ll need it to
                              import your data.
                            </p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 p-2 bg-white dark:bg-gray-800 border border-green-300 dark:border-green-600 rounded-lg text-xs font-mono text-gray-900 dark:text-white break-all">
                                {generatedKey}
                              </code>
                              <button
                                onClick={handleCopyKey}
                                className="p-2 hover:bg-green-100 dark:hover:bg-green-800 rounded-lg transition-colors flex-shrink-0"
                                title="Copy to clipboard"
                              >
                                {copied ? (
                                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                                ) : (
                                  <Copy className="w-4 h-4 text-green-600 dark:text-green-400" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex gap-3">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={mode === "export" ? !validation.valid : !password}
                  className="flex-1"
                >
                  {mode === "export" ? "Encrypt & Export" : "Decrypt & Import"}
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
