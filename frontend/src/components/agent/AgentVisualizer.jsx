import React from 'react';
import { Sparkles } from 'lucide-react';

export function AgentVisualizer({ isGeminiConnected, volume, isRecording }) {
    return (
        <div className="flex-none h-32 relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50" />

            <div className="relative h-full flex items-center justify-center overflow-hidden rounded-xl">
                {isGeminiConnected ? (
                    <div className="flex items-end justify-center gap-1.5 h-16">
                        {/* Dynamic Spectrogram Simulation */}
                        {[...Array(12)].map((_, i) => (
                            <div key={i}
                                className="w-2 bg-gradient-to-t from-indigo-500 to-purple-500 rounded-full transition-all duration-75 shadow-lg shadow-indigo-500/20"
                                style={{
                                    height: `${Math.max(15, volume * (Math.sin(i) + 1.5) * 1.2)}%`,
                                    opacity: isRecording ? 1 : 0.4
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3 text-zinc-400">
                        <div className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-full animate-pulse">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <span className="text-sm font-medium">Ready to connect...</span>
                    </div>
                )}
            </div>
        </div>
    );
}
