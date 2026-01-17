import React from 'react';
import { Terminal, Activity, Wifi, WifiOff } from 'lucide-react';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function AgentHeader({ isConnected, isGeminiConnected }) {
    return (
        <CardHeader className="flex-none border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600/10 rounded-lg">
                        <Terminal className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <CardTitle className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent text-xl font-bold">
                            Super Agent
                        </CardTitle>
                        <CardDescription className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                            Omni-Retail Orchestrator
                        </CardDescription>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Badge variant={isConnected ? "outline" : "destructive"} className="gap-1.5 transition-colors">
                        {isConnected ? <Wifi className="w-3 h-3 text-green-500" /> : <WifiOff className="w-3 h-3" />}
                        {isConnected ? "Connected" : "Offline"}
                    </Badge>
                    <div className={cn(
                        "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 transition-all",
                        isGeminiConnected
                            ? "bg-green-500/10 text-green-600 ring-green-500/20"
                            : "bg-zinc-100 text-zinc-500 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
                    )}>
                        <Activity className="w-3 h-3" />
                        {isGeminiConnected ? "Gemini Live" : "Idle"}
                    </div>
                </div>
            </div>
        </CardHeader>
    );
}
