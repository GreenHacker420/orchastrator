import React from 'react';
import { Mic, MicOff, Volume2, Send } from 'lucide-react';
import { CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function AgentControls({
    isConnected,
    inputText,
    setInputText,
    handleSendText,
    isRecording,
    toggleRecording,
    volume
}) {
    return (
        <CardFooter className="flex-none bg-zinc-50/80 dark:bg-zinc-900/40 p-6 border-t border-zinc-100 dark:border-zinc-800 rounded-b-xl flex flex-col gap-4">

            {/* Input Row */}
            <form
                onSubmit={(e) => { e.preventDefault(); handleSendText(); }}
                className="flex w-full gap-2 relative"
            >
                <Input
                    autoFocus
                    placeholder="Message Super Agent..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={!isConnected}
                    className="bg-white dark:bg-black/50 border-zinc-200 dark:border-zinc-800 focus-visible:ring-indigo-500 pr-12 shadow-sm"
                />
                <Button
                    type="submit"
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1 h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-all"
                    disabled={!isConnected || !inputText.trim()}
                >
                    <Send className="w-4 h-4" />
                </Button>
            </form>

            {/* Mic & Status */}
            <div className="flex justify-between items-center w-full pt-2">
                <div className="flex items-center gap-3 px-3 py-1.5 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-full">
                    <Volume2 className={cn("w-3.5 h-3.5 transition-colors", volume > 5 ? "text-emerald-500" : "text-zinc-400")} />
                    <div className="w-24 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 transition-all duration-100 ease-out"
                            style={{ width: `${Math.min(100, volume)}%` }}
                        />
                    </div>
                </div>

                <Button
                    size="lg"
                    variant={isRecording ? "destructive" : "default"}
                    className={cn(
                        "min-w-[160px] font-semibold tracking-wide transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0",
                        isRecording
                            ? "bg-red-500 hover:bg-red-600 animate-pulse ring-4 ring-red-500/20"
                            : "bg-indigo-600 hover:bg-indigo-700 ring-4 ring-indigo-600/10"
                    )}
                    onClick={toggleRecording}
                    disabled={!isConnected}
                >
                    {isRecording ? (
                        <>
                            <MicOff className="w-4 h-4 mr-2" /> Stop Speaking
                        </>
                    ) : (
                        <>
                            <Mic className="w-4 h-4 mr-2" /> Start Speaking
                        </>
                    )}
                </Button>
            </div>
        </CardFooter>
    );
}
