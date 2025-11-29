'use client';

import * as React from 'react';
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    SortingState,
    ColumnFiltersState,
} from '@tanstack/react-table';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ArrowUpDown, Search, Filter, LayoutGrid } from 'lucide-react';
import { updateAdStatusAction, saveFacebookToken } from '@/app/actions';
import { ConnectModal } from '@/components/ConnectModal';

export type AdData = {
    id: string;
    accountName?: string;
    name: string;
    status: string;
    delivery: string;
    budget: string;
    results: number;
    reach: number;
    impressions: number;
    spend: number;
    roas: number;
    cpm: number;
    post_engagements: number;
    link_clicks: number;
    new_messaging_contact: number;
    video_avg_time: number;
    video_plays: number;
    video_3sec: number;
    video_p25: number;
    video_p50: number;
    video_p75: number;
    video_p95: number;
    video_p100: number;
    thumbnail: string;
    currency?: string;
    accountId?: string;
    pageId?: string;
    pageName?: string;
    pageUsername?: string;
};

export function AdsTable({ data, accessToken, user }: { data: AdData[], accessToken: string, user?: any }) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [localData, setLocalData] = React.useState(data);
    const [activeTab, setActiveTab] = React.useState('Ads');

    React.useEffect(() => {
        setLocalData(data);
    }, [data]);

    const handleStatusToggle = async (adId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

        // Optimistic update
        setLocalData(prev => prev.map(ad =>
            ad.id === adId ? { ...ad, status: newStatus, delivery: newStatus } : ad
        ));

        const result = await updateAdStatusAction(accessToken, adId, newStatus);

        if (!result.success) {
            // Revert on failure
            setLocalData(prev => prev.map(ad =>
                ad.id === adId ? { ...ad, status: currentStatus, delivery: currentStatus } : ad
            ));
            alert('Failed to update status');
        }
    };

    const handleConnect = async (token: string) => {
        try {
            await saveFacebookToken(token);
            window.location.reload();
        } catch (e) {
            console.error("Failed to save token", e);
            alert("Failed to save token");
        }
    };

    const columns = React.useMemo<ColumnDef<AdData>[]>(() => [
        {
            id: "index",
            header: "#",
            cell: ({ row }) => (
                <div className="text-center text-gray-500 w-[30px]">
                    {row.index + 1}
                </div>
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: 'status',
            header: 'On/Off',
            cell: ({ row }) => {
                const status = row.getValue('status') as string;
                const isActive = status === 'ACTIVE';
                return (
                    <Switch
                        checked={isActive}
                        onCheckedChange={() => handleStatusToggle(row.original.id, status)}
                        aria-label="Toggle ad status"
                        className="data-[state=checked]:bg-blue-500"
                    />
                );
            },
        },
        {
            accessorKey: 'accountName',
            header: 'Ad Account',
            cell: ({ row }) => {
                const name = row.getValue('accountName') as string;
                const accountId = row.original.accountId;
                if (!accountId) return <div className="font-medium text-gray-700">{name || 'N/A'}</div>;

                return (
                    <div className="flex flex-col">
                        <a
                            href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${accountId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:underline"
                        >
                            {name || 'N/A'}
                        </a>
                        <span className="text-xs text-gray-500">ID: {accountId}</span>
                    </div>
                );
            },
        },
        {
            accessorKey: 'pageId',
            header: 'ID Page',
            cell: ({ row }) => {
                const pageId = row.original.pageId;
                const pageName = row.original.pageName;
                const pageUsername = row.original.pageUsername;

                if (!pageId) return <div className="text-gray-500">N/A</div>;

                return (
                    <div className="flex flex-col">
                        <a
                            href={`https://www.facebook.com/${pageId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:underline"
                        >
                            {pageUsername || pageName || pageId}
                        </a>
                        <span className="text-xs text-gray-500">ID: {pageId}</span>
                    </div>
                );
            },
        },
        {
            accessorKey: 'name',
            header: 'Ad Name',
            cell: ({ row }) => {
                const thumbnail = row.original.thumbnail;
                return (
                    <div className="flex items-center gap-3 min-w-[250px]">
                        {thumbnail && <img src={thumbnail} alt="Ad" className="w-12 h-12 object-cover rounded-md border border-gray-200" />}
                        <div className="flex flex-col gap-1">
                            <span className="font-semibold text-gray-900 line-clamp-2">{row.getValue('name')}</span>
                            <span className="text-xs text-gray-500">ID: {row.original.id}</span>
                        </div>
                    </div>
                )
            }
        },
        {
            accessorKey: 'delivery',
            header: 'Delivery',
            cell: ({ row }) => {
                const delivery = row.getValue('delivery') as string;
                return (
                    <Badge
                        variant={delivery === 'ACTIVE' ? 'default' : 'secondary'}
                        className={delivery === 'ACTIVE' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-100'}
                    >
                        {delivery}
                    </Badge>
                );
            },
        },
        {
            accessorKey: 'budget',
            header: () => <div className="text-right">Budget</div>,
            cell: ({ row }) => {
                const budget = row.getValue('budget') as string;
                const currency = row.original.currency || 'USD';
                if (budget === 'N/A') return <div className="text-right text-gray-500">N/A</div>;

                const amount = parseFloat(budget) / 100;

                return (
                    <div className="text-right font-medium text-gray-900">
                        {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: currency,
                            minimumFractionDigits: 2
                        }).format(amount)}
                    </div>
                );
            },
        },
        {
            accessorKey: 'results',
            header: ({ column }) => {
                return (
                    <div className="text-right">
                        <Button
                            variant="ghost"
                            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                            className="p-0 hover:bg-transparent"
                        >
                            Results
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                )
            },
            cell: ({ row }) => <div className="text-right font-medium text-gray-900">{new Intl.NumberFormat('en-US').format(row.getValue('results'))}</div>,
        },
        {
            accessorKey: 'reach',
            header: () => <div className="text-right">Reach</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('reach'))}</div>,
        },
        {
            accessorKey: 'impressions',
            header: () => <div className="text-right">Impressions</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('impressions'))}</div>,
        },
        {
            accessorKey: 'post_engagements',
            header: () => <div className="text-right">Post engagements</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('post_engagements'))}</div>,
        },
        {
            accessorKey: 'link_clicks',
            header: () => <div className="text-right">Link clicks</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('link_clicks'))}</div>,
        },
        {
            accessorKey: 'new_messaging_contact',
            header: () => <div className="text-right">New messaging contact</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('new_messaging_contact'))}</div>,
        },
        {
            accessorKey: 'spend',
            header: () => <div className="text-right">Amount spent</div>,
            cell: ({ row }) => {
                const spend = row.getValue('spend') as number;
                const currency = row.original.currency || 'USD';
                return (
                    <div className="text-right text-gray-700">
                        {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: currency,
                            minimumFractionDigits: 2
                        }).format(spend)}
                    </div>
                );
            },
        },
        {
            accessorKey: 'video_avg_time',
            header: () => <div className="text-right">Video average time</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{row.getValue('video_avg_time')}</div>,
        },
        {
            accessorKey: 'video_plays',
            header: () => <div className="text-right">Video play</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('video_plays'))}</div>,
        },
        {
            accessorKey: 'video_3sec',
            header: () => <div className="text-right">3-second Video play</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('video_3sec'))}</div>,
        },
        {
            accessorKey: 'video_p25',
            header: () => <div className="text-right">Video play at 25%</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('video_p25'))}</div>,
        },
        {
            accessorKey: 'video_p50',
            header: () => <div className="text-right">Video play at 50%</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('video_p50'))}</div>,
        },
        {
            accessorKey: 'video_p75',
            header: () => <div className="text-right">Video play at 75%</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('video_p75'))}</div>,
        },
        {
            accessorKey: 'video_p95',
            header: () => <div className="text-right">Video play at 95%</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('video_p95'))}</div>,
        },
        {
            accessorKey: 'video_p100',
            header: () => <div className="text-right">Video play at 100%</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('video_p100'))}</div>,
        },
    ], [accessToken]);

    const table = useReactTable({
        data: localData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
        },
    });

    const tabs = ['Ad Accounts', 'Campaigns', 'Ad Sets', 'Ads'];

    return (
        <div className="w-full bg-white">
            {/* Tabs */}
            <div className="border-b border-gray-200 px-6 flex justify-between items-center">
                <div className="flex gap-6">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
                <div className="py-2">
                    <ConnectModal onLogin={handleConnect} user={user} />
                </div>
            </div>

            {/* Filters & Search */}
            <div className="p-4 flex items-center justify-between gap-4 border-b border-gray-100">
                <div className="flex items-center gap-2 flex-1 max-w-md bg-gray-50 rounded-md px-3 py-2 border border-gray-200">
                    <Search className="h-4 w-4 text-gray-400" />
                    <input
                        placeholder="Search ads..."
                        value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn("name")?.setFilterValue(event.target.value)
                        }
                        className="bg-transparent border-none outline-none text-sm w-full placeholder:text-gray-400"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Select
                        value={(table.getColumn("delivery")?.getFilterValue() as string) ?? "ALL"}
                        onValueChange={(value) => {
                            if (value === "ALL") {
                                table.getColumn("delivery")?.setFilterValue(undefined);
                            } else {
                                table.getColumn("delivery")?.setFilterValue(value);
                            }
                        }}
                    >
                        <SelectTrigger className="w-[150px] bg-white border-gray-200">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Statuses</SelectItem>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="PAUSED">Paused</SelectItem>
                            <SelectItem value="ARCHIVED">Archived</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button variant="outline" size="icon" className="border-gray-200 text-gray-500">
                        <Filter className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="border-gray-200 text-gray-500">
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="relative overflow-x-auto">
                <Table>
                    <TableHeader className="bg-gray-50">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="border-b border-gray-200 hover:bg-gray-50">
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id} className="text-xs font-semibold text-gray-500 uppercase tracking-wider h-12 whitespace-nowrap">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && 'selected'}
                                    className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="py-3 text-sm whitespace-nowrap">
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center text-gray-500"
                                >
                                    No results found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-4 border-t border-gray-100">
                <div className="text-sm text-gray-500">
                    {table.getFilteredSelectedRowModel().rows.length} of{" "}
                    {table.getFilteredRowModel().rows.length} row(s) selected.
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        className="text-gray-600 border-gray-200"
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        className="text-gray-600 border-gray-200"
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}
