'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import {
    Material,
    Product,
    Sale,
    ProductionLog,
    MaterialTransaction,
    materialsUtils,
    productsUtils,
    salesUtils,
    productionUtils,
    materialTransactionsUtils,
    helperUtils
} from '@/lib/firebase-utils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    BarChart3,
    TrendingUp,
    DollarSign,
    Package,
    Factory,
    ShoppingCart,
    Calendar,
    Download,
    RefreshCw,
    AlertTriangle,
    ArrowUpRight,
    ArrowDownRight,
    FileText,
    Loader2,
    ChevronRight,
    Boxes,
    Activity,
    PieChart
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ReportData {
    // Financial
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    profitMargin: number;

    // Inventory
    totalMaterialValue: number;
    totalProductValue: number;
    lowStockItems: number;

    // Activities
    totalSales: number;
    totalProduction: number;
    totalMaterialImports: number;

    // Top performers
    topSellingProducts: Array<{
        productName: string;
        quantitySold: number;
        revenue: number;
    }>;

    // Time period data
    periodRevenue: number;
    periodCost: number;
    periodProfit: number;

    // Growth metrics
    revenueGrowth: number;
    profitGrowth: number;
    salesGrowth: number;
}

interface DateRange {
    startDate: string;
    endDate: string;
}

// Chart component placeholder
const MiniChart = ({ data, type, color }: { data: number[], type: 'line' | 'bar', color: string }) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min;
    
    return (
        <div className="flex items-end gap-1 h-12 w-24">
            {data.map((value, index) => {
                const height = range === 0 ? 50 : ((value - min) / range) * 100;
                return (
                    <div
                        key={index}
                        className={`flex-1 ${type === 'bar' ? 'rounded-t' : ''}`}
                        style={{
                            height: `${height}%`,
                            backgroundColor: color,
                            opacity: 0.8 + (index / data.length) * 0.2
                        }}
                    />
                );
            })}
        </div>
    );
};

// Metric card with trend
const MetricCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    color = 'blue',
    subValue,
    trend 
}: {
    title: string;
    value: string;
    change?: number;
    icon: any;
    color?: string;
    subValue?: string;
    trend?: number[];
}) => {
    const colorClasses = {
        blue: 'text-blue-600 bg-blue-50 border-blue-200',
        green: 'text-green-600 bg-green-50 border-green-200',
        orange: 'text-orange-600 bg-orange-50 border-orange-200',
        purple: 'text-purple-600 bg-purple-50 border-purple-200',
        red: 'text-red-600 bg-red-50 border-red-200'
    };

    const bgColorClasses = {
        blue: 'bg-blue-500',
        green: 'bg-green-500',
        orange: 'bg-orange-500',
        purple: 'bg-purple-500',
        red: 'bg-red-500'
    };

    return (
        <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                    <div className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
                        <Icon className="h-4 w-4" />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-baseline justify-between">
                    <div>
                        <div className="text-2xl font-bold">{value}</div>
                        {subValue && (
                            <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
                        )}
                    </div>
                    {trend && (
                        <MiniChart 
                            data={trend} 
                            type="bar" 
                            color={bgColorClasses[color as keyof typeof bgColorClasses]}
                        />
                    )}
                </div>
                {change !== undefined && (
                    <div className="flex items-center gap-1 mt-2">
                        {change >= 0 ? (
                            <ArrowUpRight className="h-4 w-4 text-green-600" />
                        ) : (
                            <ArrowDownRight className="h-4 w-4 text-red-600" />
                        )}
                        <span className={`text-xs font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {Math.abs(change).toFixed(1)}%
                        </span>
                        <span className="text-xs text-muted-foreground">so với kỳ trước</span>
                    </div>
                )}
            </CardContent>
            <div className={`absolute bottom-0 left-0 right-0 h-1 ${bgColorClasses[color as keyof typeof bgColorClasses]}`} />
        </Card>
    );
};

export default function ReportsPage() {
    const [user, loading] = useAuthState(auth);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [productions, setProductions] = useState<ProductionLog[]>([]);
    const [materialTransactions, setMaterialTransactions] = useState<MaterialTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedPeriod, setSelectedPeriod] = useState('thisMonth');
    const router = useRouter();

    const [dateRange, setDateRange] = useState<DateRange>({
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (user) {
            loadAllData();
        }
    }, [user, dateRange]);

    const handlePeriodChange = (period: string) => {
        setSelectedPeriod(period);
        const today = new Date();
        let startDate: Date;
        let endDate = today;

        switch (period) {
            case 'today':
                startDate = today;
                break;
            case 'yesterday':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 1);
                endDate = new Date(startDate);
                break;
            case 'thisWeek':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - today.getDay());
                break;
            case 'lastWeek':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - today.getDay() - 7);
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                break;
            case 'thisMonth':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                break;
            case 'lastMonth':
                startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                endDate = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case 'thisQuarter':
                const quarter = Math.floor(today.getMonth() / 3);
                startDate = new Date(today.getFullYear(), quarter * 3, 1);
                break;
            case 'thisYear':
                startDate = new Date(today.getFullYear(), 0, 1);
                break;
            default:
                return;
        }

        setDateRange({
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        });
    };

    const loadAllData = async () => {
        try {
            setIsLoading(true);

            const [
                materialsData,
                productsData,
                salesData,
                productionsData,
                materialTransactionsData
            ] = await Promise.all([
                materialsUtils.getAll(),
                productsUtils.getAll(),
                salesUtils.getSalesHistory(),
                productionUtils.getProductionHistory(),
                materialTransactionsUtils.getHistory()
            ]);

            setMaterials(materialsData);
            setProducts(productsData);
            setSales(salesData);
            setProductions(productionsData);
            setMaterialTransactions(materialTransactionsData);

            // Calculate report data
            const report = calculateReportData(
                materialsData,
                productsData,
                salesData,
                productionsData,
                materialTransactionsData
            );
            setReportData(report);

        } catch (error) {
            console.error('Error loading report data:', error);
            toast.error('Không thể tải dữ liệu báo cáo');
        } finally {
            setIsLoading(false);
        }
    };

    const calculateReportData = (
        materialsData: Material[],
        productsData: Product[],
        salesData: Sale[],
        productionsData: ProductionLog[],
        materialTransactionsData: MaterialTransaction[]
    ): ReportData => {
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        endDate.setHours(23, 59, 59, 999);

        // Calculate previous period for growth metrics
        const periodLength = endDate.getTime() - startDate.getTime();
        const prevStartDate = new Date(startDate.getTime() - periodLength);
        const prevEndDate = new Date(startDate.getTime() - 1);

        // Filter data by date range
        const periodSales = salesData.filter(sale => {
            const saleDate = sale.createdAt?.toDate();
            return saleDate && saleDate >= startDate && saleDate <= endDate;
        });

        const prevPeriodSales = salesData.filter(sale => {
            const saleDate = sale.createdAt?.toDate();
            return saleDate && saleDate >= prevStartDate && saleDate <= prevEndDate;
        });

        const periodProductions = productionsData.filter(production => {
            const productionDate = production.createdAt?.toDate();
            return productionDate && productionDate >= startDate && productionDate <= endDate;
        });

        const periodMaterialTransactions = materialTransactionsData.filter(transaction => {
            const transactionDate = transaction.createdAt?.toDate();
            return transactionDate && transactionDate >= startDate && transactionDate <= endDate;
        });

        // Calculate financial metrics
        const totalRevenue = salesData.reduce((sum, sale) => sum + sale.totalRevenue, 0);
        const totalCost = productionsData.reduce((sum, production) => sum + production.totalCost, 0);
        const totalProfit = totalRevenue - totalCost;
        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

        const periodRevenue = periodSales.reduce((sum, sale) => sum + sale.totalRevenue, 0);
        const periodCost = periodProductions.reduce((sum, production) => sum + production.totalCost, 0);
        const periodProfit = periodRevenue - periodCost;

        const prevPeriodRevenue = prevPeriodSales.reduce((sum, sale) => sum + sale.totalRevenue, 0);
        const prevPeriodProfit = prevPeriodRevenue - periodCost; // Simplified

        // Calculate growth metrics
        const revenueGrowth = prevPeriodRevenue > 0 
            ? ((periodRevenue - prevPeriodRevenue) / prevPeriodRevenue) * 100 
            : 0;
        const profitGrowth = prevPeriodProfit > 0 
            ? ((periodProfit - prevPeriodProfit) / prevPeriodProfit) * 100 
            : 0;
        const salesGrowth = prevPeriodSales.length > 0
            ? ((periodSales.length - prevPeriodSales.length) / prevPeriodSales.length) * 100
            : 0;

        // Calculate inventory values
        const totalMaterialValue = materialsData.reduce(
            (sum, material) => sum + (material.currentStock * material.unitPrice),
            0
        );

        const totalProductValue = productsData.reduce((sum, product) => {
            const productProductions = productionsData.filter(p => p.productId === product.id);
            const avgCostPerUnit = productProductions.length > 0
                ? productProductions.reduce((s, p) => s + p.costPerUnit, 0) / productProductions.length
                : 0;
            return sum + (product.currentStock * avgCostPerUnit);
        }, 0);

        const lowStockItems = materialsData.filter(material => material.currentStock < 10).length;

        // Calculate activities
        const totalSales = salesData.reduce((sum, sale) => sum + sale.quantity, 0);
        const totalProduction = productionsData.reduce((sum, production) => sum + production.quantityProduced, 0);
        const totalMaterialImports = materialTransactionsData
            .filter(transaction => transaction.type === 'import')
            .reduce((sum, transaction) => sum + transaction.quantity, 0);

        // Calculate top selling products
        const productSalesMap = new Map<string, { productName: string; quantitySold: number; revenue: number }>();

        salesData.forEach(sale => {
            const existing = productSalesMap.get(sale.productId) || {
                productName: sale.productName,
                quantitySold: 0,
                revenue: 0
            };
            existing.quantitySold += sale.quantity;
            existing.revenue += sale.totalRevenue;
            productSalesMap.set(sale.productId, existing);
        });

        const topSellingProducts = Array.from(productSalesMap.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        return {
            totalRevenue,
            totalCost,
            totalProfit,
            profitMargin,
            totalMaterialValue,
            totalProductValue,
            lowStockItems,
            totalSales,
            totalProduction,
            totalMaterialImports,
            topSellingProducts,
            periodRevenue,
            periodCost,
            periodProfit,
            revenueGrowth,
            profitGrowth,
            salesGrowth
        };
    };

    const exportToExcel = async (type: 'overview' | 'sales' | 'production' | 'inventory') => {
        setIsExporting(true);
        try {
            const wb = XLSX.utils.book_new();

            switch (type) {
                case 'overview':
                    // Create overview sheet
                    const overviewData = [
                        ['BÁO CÁO TỔNG QUAN'],
                        ['Từ ngày', dateRange.startDate, 'Đến ngày', dateRange.endDate],
                        [],
                        ['THÔNG TIN TÀI CHÍNH'],
                        ['Tổng doanh thu', reportData?.totalRevenue || 0],
                        ['Tổng chi phí', reportData?.totalCost || 0],
                        ['Lợi nhuận', reportData?.totalProfit || 0],
                        ['Biên lợi nhuận (%)', reportData?.profitMargin || 0],
                        [],
                        ['HOẠT ĐỘNG'],
                        ['Tổng số lượng bán', reportData?.totalSales || 0],
                        ['Tổng sản xuất', reportData?.totalProduction || 0],
                        ['Tổng nhập vật tư', reportData?.totalMaterialImports || 0],
                        [],
                        ['TỒN KHO'],
                        ['Giá trị vật tư', reportData?.totalMaterialValue || 0],
                        ['Giá trị sản phẩm', reportData?.totalProductValue || 0],
                        ['Tổng giá trị tồn kho', (reportData?.totalMaterialValue || 0) + (reportData?.totalProductValue || 0)]
                    ];
                    const ws = XLSX.utils.aoa_to_sheet(overviewData);
                    XLSX.utils.book_append_sheet(wb, ws, 'Tổng quan');
                    break;

                case 'sales':
                    // Create sales sheet
                    const salesHeaders = ['Mã', 'Ngày', 'Sản phẩm', 'Số lượng', 'Đơn giá', 'Tổng tiền', 'Ghi chú'];
                    const salesRows = sales.map(sale => [
                        sale.id,
                        sale.createdAt?.toDate().toLocaleDateString('vi-VN') || '',
                        sale.productName,
                        sale.quantity,
                        sale.unitPrice,
                        sale.totalRevenue,
                        sale.note || ''
                    ]);
                    const salesSheet = XLSX.utils.aoa_to_sheet([salesHeaders, ...salesRows]);
                    XLSX.utils.book_append_sheet(wb, salesSheet, 'Bán hàng');
                    break;

                case 'production':
                    // Create production sheet
                    const productionHeaders = ['Mã', 'Ngày', 'Sản phẩm', 'Số lượng SX', 'Chi phí/SP', 'Tổng chi phí'];
                    const productionRows = productions.map(prod => [
                        prod.id,
                        prod.createdAt?.toDate().toLocaleDateString('vi-VN') || '',
                        prod.productName,
                        prod.quantityProduced,
                        prod.costPerUnit,
                        prod.totalCost
                    ]);
                    const productionSheet = XLSX.utils.aoa_to_sheet([productionHeaders, ...productionRows]);
                    XLSX.utils.book_append_sheet(wb, productionSheet, 'Sản xuất');
                    break;

                case 'inventory':
                    // Create materials sheet
                    const materialsHeaders = ['Mã', 'Tên vật tư', 'Tồn kho', 'Đơn vị', 'Đơn giá', 'Giá trị'];
                    const materialsRows = materials.map(mat => [
                        mat.id,
                        mat.name,
                        mat.currentStock,
                        mat.unit,
                        mat.unitPrice,
                        mat.currentStock * mat.unitPrice
                    ]);
                    const materialsSheet = XLSX.utils.aoa_to_sheet([materialsHeaders, ...materialsRows]);
                    XLSX.utils.book_append_sheet(wb, materialsSheet, 'Vật tư');

                    // Create products sheet
                    const productsHeaders = ['Mã', 'Tên sản phẩm', 'Tồn kho', 'Giá bán'];
                    const productsRows = products.map(prod => [
                        prod.id,
                        prod.name,
                        prod.currentStock,
                        prod.sellingPrice
                    ]);
                    const productsSheet = XLSX.utils.aoa_to_sheet([productsHeaders, ...productsRows]);
                    XLSX.utils.book_append_sheet(wb, productsSheet, 'Sản phẩm');
                    break;
            }

            // Generate filename
            const filename = `baocao_${type}_${dateRange.startDate}_${dateRange.endDate}.xlsx`;
            
            // Write file
            XLSX.writeFile(wb, filename);
            toast.success('Xuất báo cáo thành công!');

        } catch (error) {
            console.error('Error exporting report:', error);
            toast.error('Không thể xuất báo cáo');
        } finally {
            setIsExporting(false);
        }
    };

    const formatPercentage = (value: number) => {
        return `${value.toFixed(1)}%`;
    };

    const getRecentTransactions = () => {
        const allTransactions = [
            ...sales.map(sale => ({
                id: sale.id!,
                type: 'sale' as const,
                description: `Bán ${sale.quantity} ${sale.productName}`,
                amount: sale.totalRevenue,
                date: sale.createdAt?.toDate() || new Date(),
                status: 'success' as const
            })),
            ...productions.map(production => ({
                id: production.id!,
                type: 'production' as const,
                description: `SX ${production.quantityProduced} ${production.productName}`,
                amount: -production.totalCost,
                date: production.createdAt?.toDate() || new Date(),
                status: 'info' as const
            })),
            ...materialTransactions
                .filter(transaction => transaction.type === 'import')
                .map(transaction => ({
                    id: transaction.id!,
                    type: 'material_import' as const,
                    description: `Nhập ${transaction.quantity} ${transaction.materialName}`,
                    amount: -transaction.totalAmount,
                    date: transaction.createdAt?.toDate() || new Date(),
                    status: 'warning' as const
                }))
        ];

        return allTransactions
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .slice(0, 10);
    };

    if (loading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                    <p className="mt-2 text-sm text-muted-foreground">Đang tải dữ liệu báo cáo...</p>
                </div>
            </div>
        );
    }

    if (!user || !reportData) {
        return null;
    }

    const recentTransactions = getRecentTransactions();

    // Mock trend data
    const revenueTrend = [65, 72, 68, 75, 82, 79, 85];
    const profitTrend = [45, 52, 48, 55, 62, 59, 65];
    const salesTrend = [120, 135, 125, 140, 155, 145, 160];
    const productionTrend = [100, 115, 105, 120, 135, 125, 140];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Header */}
            <div className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <BarChart3 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold">Báo cáo & Thống kê</h1>
                                <p className="text-xs text-muted-foreground">
                                    Cập nhật lúc {new Date().toLocaleTimeString('vi-VN')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                                <SelectTrigger className="w-[160px]">
                                    <Calendar className="h-4 w-4 mr-2" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="today">Hôm nay</SelectItem>
                                    <SelectItem value="yesterday">Hôm qua</SelectItem>
                                    <SelectItem value="thisWeek">Tuần này</SelectItem>
                                    <SelectItem value="lastWeek">Tuần trước</SelectItem>
                                    <SelectItem value="thisMonth">Tháng này</SelectItem>
                                    <SelectItem value="lastMonth">Tháng trước</SelectItem>
                                    <SelectItem value="thisQuarter">Quý này</SelectItem>
                                    <SelectItem value="thisYear">Năm nay</SelectItem>
                                    <SelectItem value="custom">Tùy chỉnh</SelectItem>
                                </SelectContent>
                            </Select>

                            <Button variant="outline" size="icon" onClick={loadAllData}>
                                <RefreshCw className="h-4 w-4" />
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline">
                                        <Download className="h-4 w-4 mr-2" />
                                        Xuất báo cáo
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuLabel>Chọn loại báo cáo</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                        onClick={() => exportToExcel('overview')}
                                        disabled={isExporting}
                                    >
                                        <FileText className="h-4 w-4 mr-2" />
                                        Báo cáo tổng quan
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                        onClick={() => exportToExcel('sales')}
                                        disabled={isExporting}
                                    >
                                        <ShoppingCart className="h-4 w-4 mr-2" />
                                        Chi tiết bán hàng
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                        onClick={() => exportToExcel('production')}
                                        disabled={isExporting}
                                    >
                                        <Factory className="h-4 w-4 mr-2" />
                                        Chi tiết sản xuất
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                        onClick={() => exportToExcel('inventory')}
                                        disabled={isExporting}
                                    >
                                        <Package className="h-4 w-4 mr-2" />
                                        Báo cáo tồn kho
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="space-y-6">
                    {/* Key Metrics */}
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                        <MetricCard
                            title="Doanh thu"
                            value={helperUtils.formatCurrency(reportData.periodRevenue)}
                            change={reportData.revenueGrowth}
                            icon={DollarSign}
                            color="green"
                            subValue={`Tổng: ${helperUtils.formatCurrency(reportData.totalRevenue)}`}
                            trend={revenueTrend}
                        />
                        <MetricCard
                            title="Lợi nhuận"
                            value={helperUtils.formatCurrency(reportData.periodProfit)}
                            change={reportData.profitGrowth}
                            icon={TrendingUp}
                            color={reportData.periodProfit >= 0 ? "blue" : "red"}
                            subValue={`Biên LN: ${formatPercentage(reportData.profitMargin)}`}
                            trend={profitTrend}
                        />
                        <MetricCard
                            title="Đơn hàng"
                            value={`${sales.filter(s => {
                                const saleDate = s.createdAt?.toDate();
                                return saleDate && saleDate >= new Date(dateRange.startDate) && saleDate <= new Date(dateRange.endDate);
                            }).length}`}
                            change={reportData.salesGrowth}
                            icon={ShoppingCart}
                            color="purple"
                            subValue={`${reportData.totalSales} sản phẩm`}
                            trend={salesTrend}
                        />
                        <MetricCard
                            title="Tồn kho"
                            value={helperUtils.formatCurrency(reportData.totalMaterialValue + reportData.totalProductValue)}
                            icon={Package}
                            color={reportData.lowStockItems > 0 ? "orange" : "green"}
                            subValue={reportData.lowStockItems > 0 ? `${reportData.lowStockItems} mặt hàng sắp hết` : "Tồn kho ổn định"}
                        />
                    </div>

                    {/* Quick Stats */}
                    <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
                        {/* Activity Overview */}
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <Activity className="h-5 w-5 text-primary" />
                                        Hoạt động gần đây
                                    </span>
                                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('overview')}>
                                        Xem tất cả
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[300px] pr-4">
                                    <div className="space-y-4">
                                        {recentTransactions.slice(0, 8).map((transaction) => (
                                            <div key={transaction.id} className="flex items-start justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                                <div className="flex items-start gap-3">
                                                    <div className={`p-2 rounded-lg ${
                                                        transaction.type === 'sale' ? 'bg-green-100 text-green-600' :
                                                        transaction.type === 'production' ? 'bg-blue-100 text-blue-600' :
                                                        'bg-purple-100 text-purple-600'
                                                    }`}>
                                                        {transaction.type === 'sale' && <ShoppingCart className="h-4 w-4" />}
                                                        {transaction.type === 'production' && <Factory className="h-4 w-4" />}
                                                        {transaction.type === 'material_import' && <Package className="h-4 w-4" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium">{transaction.description}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {helperUtils.formatTimeAgo(transaction.date)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`text-sm font-medium ${
                                                        transaction.amount >= 0 ? 'text-green-600' : 'text-muted-foreground'
                                                    }`}>
                                                        {transaction.amount >= 0 ? '+' : ''}{helperUtils.formatCurrency(Math.abs(transaction.amount))}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        {/* Top Products */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <PieChart className="h-5 w-5 text-primary" />
                                    Top sản phẩm
                                </CardTitle>
                                <CardDescription>Theo doanh thu</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {reportData.topSellingProducts.map((product, index) => {
                                        const percentage = (product.revenue / reportData.totalRevenue) * 100;
                                        return (
                                            <div key={index} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Badge 
                                                            variant={index === 0 ? "default" : "secondary"}
                                                            className="w-6 h-6 p-0 flex items-center justify-center"
                                                        >
                                                            {index + 1}
                                                        </Badge>
                                                        <span className="text-sm font-medium truncate max-w-[150px]">
                                                            {product.productName}
                                                        </span>
                                                    </div>
                                                    <span className="text-sm font-medium">
                                                        {formatPercentage(percentage)}
                                                    </span>
                                                </div>
                                                <Progress value={percentage} className="h-2" />
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>{product.quantitySold} sản phẩm</span>
                                                    <span>{helperUtils.formatCurrency(product.revenue)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Detailed Reports Tabs */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Báo cáo chi tiết</CardTitle>
                            <CardDescription>
                                Phân tích chi tiết theo từng danh mục
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                                <TabsList className="grid w-full grid-cols-4 h-12">
                                    <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                        <BarChart3 className="h-4 w-4 mr-2" />
                                        Tổng quan
                                    </TabsTrigger>
                                    <TabsTrigger value="sales" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                        <ShoppingCart className="h-4 w-4 mr-2" />
                                        Bán hàng
                                    </TabsTrigger>
                                    <TabsTrigger value="production" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                        <Factory className="h-4 w-4 mr-2" />
                                        Sản xuất
                                    </TabsTrigger>
                                    <TabsTrigger value="inventory" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                        <Boxes className="h-4 w-4 mr-2" />
                                        Tồn kho
                                    </TabsTrigger>
                                </TabsList>

                                {/* Overview Tab */}
                                <TabsContent value="overview" className="space-y-4">
                                    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                                        {/* Financial Summary */}
                                        <Card>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base">Tóm tắt tài chính</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm text-muted-foreground">Doanh thu kỳ này</span>
                                                            <span className="text-sm font-medium text-green-600">
                                                                {helperUtils.formatCurrency(reportData.periodRevenue)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm text-muted-foreground">Chi phí sản xuất</span>
                                                            <span className="text-sm font-medium text-orange-600">
                                                                {helperUtils.formatCurrency(reportData.periodCost)}
                                                            </span>
                                                        </div>
                                                        <Separator />
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-medium">Lợi nhuận</span>
                                                            <span className={`text-sm font-bold ${
                                                                reportData.periodProfit >= 0 ? 'text-green-600' : 'text-red-600'
                                                            }`}>
                                                                {helperUtils.formatCurrency(reportData.periodProfit)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm text-muted-foreground">Tổng doanh thu (all time)</span>
                                                            <span className="text-sm font-medium">
                                                                {helperUtils.formatCurrency(reportData.totalRevenue)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm text-muted-foreground">Biên lợi nhuận</span>
                                                            <Badge variant={reportData.profitMargin >= 30 ? "default" : "secondary"}>
                                                                {formatPercentage(reportData.profitMargin)}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Activity Summary */}
                                        <Card>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base">Hoạt động kinh doanh</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
                                                        <ShoppingCart className="h-8 w-8 text-green-600 mx-auto mb-2" />
                                                        <div className="text-2xl font-bold text-green-600">
                                                            {reportData.totalSales}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">Sản phẩm bán</div>
                                                    </div>

                                                    <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-200">
                                                        <Factory className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                                                        <div className="text-2xl font-bold text-blue-600">
                                                            {reportData.totalProduction}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">Sản phẩm SX</div>
                                                    </div>

                                                    <div className="text-center p-4 rounded-lg bg-purple-50 border border-purple-200">
                                                        <Package className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                                                        <div className="text-2xl font-bold text-purple-600">
                                                            {reportData.totalMaterialImports}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">Vật tư nhập</div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 p-4 rounded-lg bg-muted/50">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm font-medium">Hiệu suất hoạt động</span>
                                                        <Badge variant="outline">
                                                            {((reportData.totalSales / reportData.totalProduction) * 100).toFixed(1)}%
                                                        </Badge>
                                                    </div>
                                                    <Progress 
                                                        value={(reportData.totalSales / reportData.totalProduction) * 100} 
                                                        className="h-2"
                                                    />
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Tỷ lệ sản phẩm đã bán / sản xuất
                                                    </p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>

                                {/* Sales Tab */}
                                <TabsContent value="sales" className="space-y-4">
                                    <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
                                        {/* Sales Analytics */}
                                        <Card className="lg:col-span-2">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base">Phân tích bán hàng</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div className="space-y-1">
                                                        <p className="text-sm text-muted-foreground">Doanh thu TB/đơn</p>
                                                        <p className="text-2xl font-bold">
                                                            {sales.length > 0
                                                                ? helperUtils.formatCurrency(reportData.totalRevenue / sales.length)
                                                                : helperUtils.formatCurrency(0)
                                                            }
                                                        </p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-sm text-muted-foreground">Sản phẩm/đơn TB</p>
                                                        <p className="text-2xl font-bold">
                                                            {sales.length > 0
                                                                ? (reportData.totalSales / sales.length).toFixed(1)
                                                                : '0'
                                                            }
                                                        </p>
                                                    </div>
                                                </div>

                                                <Separator className="my-4" />

                                                <div className="space-y-3">
                                                    <h4 className="text-sm font-medium">Đơn hàng gần nhất</h4>
                                                    {sales.slice(0, 5).map((sale) => (
                                                        <div key={sale.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                                            <div>
                                                                <p className="text-sm font-medium">{sale.productName}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {sale.quantity} x {helperUtils.formatCurrency(sale.unitPrice)}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-sm font-medium text-green-600">
                                                                    {helperUtils.formatCurrency(sale.totalRevenue)}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {sale.createdAt?.toDate().toLocaleDateString('vi-VN')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Sales Summary */}
                                        <Card>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base">Thống kê</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-muted-foreground">Tổng đơn hàng</span>
                                                        <span className="text-sm font-medium">{sales.length}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-muted-foreground">Đơn hàng kỳ này</span>
                                                        <span className="text-sm font-medium">
                                                            {sales.filter(s => {
                                                                const saleDate = s.createdAt?.toDate();
                                                                return saleDate && saleDate >= new Date(dateRange.startDate) && saleDate <= new Date(dateRange.endDate);
                                                            }).length}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-muted-foreground">Tăng trưởng</span>
                                                        <Badge variant={reportData.revenueGrowth >= 0 ? "default" : "destructive"}>
                                                            {reportData.revenueGrowth >= 0 ? '+' : ''}{reportData.revenueGrowth.toFixed(1)}%
                                                        </Badge>
                                                    </div>
                                                </div>

                                                <Separator />

                                                <div>
                                                    <h4 className="text-sm font-medium mb-3">Sản phẩm bán chạy</h4>
                                                    <div className="space-y-2">
                                                        {reportData.topSellingProducts.slice(0, 3).map((product, index) => (
                                                            <div key={index} className="flex items-center gap-2">
                                                                <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">
                                                                    {index + 1}
                                                                </Badge>
                                                                <span className="text-sm flex-1 truncate">{product.productName}</span>
                                                                <span className="text-sm font-medium">{product.quantitySold}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>

                                {/* Production Tab */}
                                <TabsContent value="production" className="space-y-4">
                                    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                                        {/* Production Stats */}
                                        <Card>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base">Thống kê sản xuất</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div className="space-y-1">
                                                        <p className="text-sm text-muted-foreground">Chi phí TB/SP</p>
                                                        <p className="text-2xl font-bold text-orange-600">
                                                            {reportData.totalProduction > 0
                                                                ? helperUtils.formatCurrency(reportData.totalCost / reportData.totalProduction)
                                                                : helperUtils.formatCurrency(0)
                                                            }
                                                        </p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-sm text-muted-foreground">SL TB/lần SX</p>
                                                        <p className="text-2xl font-bold">
                                                            {productions.length > 0
                                                                ? (reportData.totalProduction / productions.length).toFixed(1)
                                                                : '0'
                                                            }
                                                        </p>
                                                    </div>
                                                </div>

                                                <Separator className="my-4" />

                                                <div className="space-y-3">
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-muted-foreground">Tổng chi phí SX</span>
                                                        <span className="text-sm font-medium text-orange-600">
                                                            {helperUtils.formatCurrency(reportData.totalCost)}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-muted-foreground">Số lần sản xuất</span>
                                                        <span className="text-sm font-medium">{productions.length}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-muted-foreground">Tổng sản lượng</span>
                                                        <span className="text-sm font-medium">{reportData.totalProduction} SP</span>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Material Costs */}
                                        <Card>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base">Chi phí vật tư</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-4">
                                                    <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-sm font-medium">Tổng nhập vật tư</span>
                                                            <Package className="h-4 w-4 text-blue-600" />
                                                        </div>
                                                        <p className="text-2xl font-bold text-blue-600">
                                                            {helperUtils.formatCurrency(
                                                                materialTransactions
                                                                    .filter(t => t.type === 'import')
                                                                    .reduce((sum, t) => sum + t.totalAmount, 0)
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-sm font-medium">Giá trị tồn kho VT</span>
                                                            <Boxes className="h-4 w-4 text-purple-600" />
                                                        </div>
                                                        <p className="text-2xl font-bold text-purple-600">
                                                            {helperUtils.formatCurrency(reportData.totalMaterialValue)}
                                                        </p>
                                                    </div>

                                                    {reportData.lowStockItems > 0 && (
                                                        <Alert className="border-orange-200 bg-orange-50">
                                                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                                                            <AlertDescription className="text-orange-800">
                                                                {reportData.lowStockItems} loại vật tư sắp hết ({"<"} 10 đơn vị)
                                                            </AlertDescription>
                                                        </Alert>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Recent Productions */}
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base">Lịch sử sản xuất gần nhất</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-3">
                                                {productions.slice(0, 5).map((production) => (
                                                    <div key={production.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                                                                <Factory className="h-4 w-4" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium">{production.productName}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {production.quantityProduced} sản phẩm • {helperUtils.formatCurrency(production.costPerUnit)}/SP
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-medium text-orange-600">
                                                                {helperUtils.formatCurrency(production.totalCost)}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {production.createdAt?.toDate().toLocaleDateString('vi-VN')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                {/* Inventory Tab */}
                                <TabsContent value="inventory" className="space-y-4">
                                    {/* Inventory Overview */}
                                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                                        <Card className="border-blue-200 bg-blue-50/50">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base text-blue-700">Giá trị vật tư</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-2xl font-bold text-blue-600">
                                                    {helperUtils.formatCurrency(reportData.totalMaterialValue)}
                                                </p>
                                                <p className="text-xs text-blue-600/80 mt-1">
                                                    {materials.length} loại vật tư
                                                </p>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-green-200 bg-green-50/50">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base text-green-700">Giá trị sản phẩm</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-2xl font-bold text-green-600">
                                                    {helperUtils.formatCurrency(reportData.totalProductValue)}
                                                </p>
                                                <p className="text-xs text-green-600/80 mt-1">
                                                    {products.reduce((sum, p) => sum + p.currentStock, 0)} sản phẩm
                                                </p>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-purple-200 bg-purple-50/50">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base text-purple-700">Tổng giá trị</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-2xl font-bold text-purple-600">
                                                    {helperUtils.formatCurrency(reportData.totalMaterialValue + reportData.totalProductValue)}
                                                </p>
                                                <p className="text-xs text-purple-600/80 mt-1">
                                                    Toàn bộ tồn kho
                                                </p>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {reportData.lowStockItems > 0 && (
                                        <Alert className="border-orange-200 bg-orange-50">
                                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                                            <AlertDescription>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <span className="font-medium text-orange-800">Cảnh báo tồn kho thấp: </span>
                                                        <span className="text-orange-700">
                                                            {reportData.lowStockItems} loại vật tư có tồn kho dưới 10 đơn vị
                                                        </span>
                                                    </div>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        className="border-orange-300 text-orange-700 hover:bg-orange-100"
                                                        onClick={() => router.push('/inventory')}
                                                    >
                                                        Xem chi tiết
                                                        <ChevronRight className="h-4 w-4 ml-1" />
                                                    </Button>
                                                </div>
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                                        {/* Materials Inventory */}
                                        <Card>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base flex items-center justify-between">
                                                    <span>Tồn kho vật tư</span>
                                                    <Badge variant="secondary">{materials.length} loại</Badge>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <ScrollArea className="h-[300px] pr-4">
                                                    <div className="space-y-3">
                                                        {materials.map((material) => (
                                                            <div key={material.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                                                <div className="flex-1">
                                                                    <p className="text-sm font-medium">{material.name}</p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {helperUtils.formatCurrency(material.unitPrice)}/{material.unit}
                                                                    </p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <Badge
                                                                        variant={material.currentStock < 10 ? "destructive" : material.currentStock < 50 ? "secondary" : "default"}
                                                                        className="mb-1"
                                                                    >
                                                                        {material.currentStock} {material.unit}
                                                                    </Badge>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {helperUtils.formatCurrency(material.currentStock * material.unitPrice)}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            </CardContent>
                                        </Card>

                                        {/* Products Inventory */}
                                        <Card>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base flex items-center justify-between">
                                                    <span>Tồn kho sản phẩm</span>
                                                    <Badge variant="secondary">{products.length} loại</Badge>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <ScrollArea className="h-[300px] pr-4">
                                                    <div className="space-y-3">
                                                        {products.map((product) => {
                                                            const productProductions = productions.filter(p => p.productId === product.id);
                                                            const avgCostPerUnit = productProductions.length > 0
                                                                ? productProductions.reduce((s, p) => s + p.costPerUnit, 0) / productProductions.length
                                                                : 0;
                                                            const estimatedValue = product.currentStock * avgCostPerUnit;

                                                            return (
                                                                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-medium">{product.name}</p>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            Giá bán: {helperUtils.formatCurrency(product.sellingPrice)}
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <Badge
                                                                            variant={product.currentStock === 0 ? "destructive" : product.currentStock < 10 ? "secondary" : "default"}
                                                                            className="mb-1"
                                                                        >
                                                                            {product.currentStock} SP
                                                                        </Badge>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            ~{helperUtils.formatCurrency(estimatedValue)}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </ScrollArea>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>

                    {/* Custom Date Range (if selected) */}
                    {selectedPeriod === 'custom' && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Calendar className="h-5 w-5" />
                                    Tùy chỉnh khoảng thời gian
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="start-date">Từ ngày</Label>
                                        <Input
                                            id="start-date"
                                            type="date"
                                            value={dateRange.startDate}
                                            onChange={(e) => setDateRange(prev => ({
                                                ...prev,
                                                startDate: e.target.value
                                            }))}
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="end-date">Đến ngày</Label>
                                        <Input
                                            id="end-date"
                                            type="date"
                                            value={dateRange.endDate}
                                            onChange={(e) => setDateRange(prev => ({
                                                ...prev,
                                                endDate: e.target.value
                                            }))}
                                            className="w-full"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>
        </div>
    );
}