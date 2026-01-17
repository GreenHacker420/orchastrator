import React, { useEffect, useState } from 'react';
import { X, Database, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function DebugInfo({ onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5050';
                const url = `${baseUrl.replace(/\/$/, '')}/api/debug/data`;

                const res = await fetch(url);
                if (!res.ok) throw new Error('Failed to fetch data');
                const json = await res.json();
                setData(json);
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border-zinc-200 dark:border-zinc-800">
                <CardHeader className="flex-none flex flex-row items-center justify-between border-b bg-zinc-50/50 dark:bg-zinc-900/50 py-4">
                    <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-indigo-500" />
                        <CardTitle className="text-lg">Mock Database Inspector</CardTitle>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-5 h-5 opacity-70" />
                    </button>
                </CardHeader>

                <CardContent className="flex-1 min-h-0 bg-zinc-50/30 dark:bg-zinc-900/30 p-0">
                    {loading ? (
                        <div className="flex h-full items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 opacity-50" />
                        </div>
                    ) : error ? (
                        <div className="flex h-full items-center justify-center text-red-500">
                            Error: {error}
                        </div>
                    ) : (
                        <ScrollArea className="h-full">
                            <div className="p-6 space-y-8">
                                <Section title="ShopCore: Users & Orders" data={data.users} icon="🛍️" />
                                <Section title="ShipStream: Logistics" data={data.shipments} icon="🚚" />
                                <Section title="CareDesk: Support Tickets" data={data.tickets} icon="🎫" />
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function Section({ title, data, icon }) {
    if (!data || data.length === 0) return null;
    return (
        <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                <span>{icon}</span> {title}
            </h3>
            <div className="grid grid-cols-1 gap-3">
                {data.map((item, i) => (
                    <div key={i} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-sm font-mono overflow-auto max-h-40">
                        <pre className="text-xs text-zinc-600 dark:text-zinc-400">
                            {JSON.stringify(item, null, 2)}
                        </pre>
                    </div>
                ))}
            </div>
        </div>
    );
}
