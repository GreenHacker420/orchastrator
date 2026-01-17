import React, { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export function AgentLogs({ logs }) {
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    return (
        <ScrollArea className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 p-4 shadow-inner">
            <div className="space-y-3 font-mono text-sm leading-relaxed">
                {logs.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-8 text-zinc-400 gap-2 opacity-50">
                        <Terminal className="w-8 h-8 mb-2" />
                        <p>System initialized.</p>
                        <p>Logs will appear here.</p>
                    </div>
                )}
                {logs.map((log, i) => (
                    <div key={i} className="flex gap-3 group animate-in fade-in slide-in-from-left-2 duration-300">
                        <span className="text-zinc-400 text-xs mt-1 shrink-0 font-light tabular-nums opacity-50 group-hover:opacity-100 transition-opacity">
                            {log.time}
                        </span>
                        <div className="flex-1 break-words">
                            <span className={cn(
                                "font-bold mr-2 text-xs uppercase tracking-wide",
                                log.source === 'System' && "text-blue-500",
                                log.source === 'Error' && "text-red-500",
                                log.source.includes('User') && "text-emerald-500",
                                log.source === 'Model' && "text-indigo-500"
                            )}>{log.source}</span>
                            <span className="text-zinc-700 dark:text-zinc-300">
                                {log.message}
                            </span>
                        </div>
                    </div>
                ))}
                <div ref={scrollRef} /> {/* Auto-scroll anchor */}
            </div>
        </ScrollArea>
    );
}
