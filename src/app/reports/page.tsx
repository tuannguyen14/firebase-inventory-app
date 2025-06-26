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
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Package,
    Factory,
    ShoppingCart,
    Calendar,
    Download,
    RefreshCw,
    AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

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
}

interface DateRange {
    startDate: string;
    endDate: string;
}

export default function ReportsPage() {
    const [user, loading] = useAuthState(auth);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [productions, setProductions] = useState<ProductionLog[]>([]);
    const [materialTransactions, setMaterialTransactions] = useState<MaterialTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [activeTab, setActiveTab] = useState('overview');
    const router = useRouter();

    const [dateRange, setDateRange] = useState<DateRange>({
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], // First day of current month
        endDate: new Date().toISOString().split('T')[0] // Today
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
        endDate.setHours(23, 59, 59, 999); // End of day

        // Filter data by date range
        const periodSales = salesData.filter(sale => {
            const saleDate = sale.createdAt?.toDate();
            return saleDate && saleDate >= startDate && saleDate <= endDate;
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

        // Calculate inventory values
        const totalMaterialValue = materialsData.reduce(
            (sum, material) => sum + (material.currentStock * material.unitPrice),
            0
        );

        const totalProductValue = productsData.reduce((sum, product) => {
            // Estimate product value based on average production cost
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
            periodProfit
        };
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
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!user || !reportData) {
        return null;
    }

    const recentTransactions = getRecentTransactions();

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <BarChart3 className="h-5 w-5 text-primary" />
                            <h1 className="text-xl font-semibold">Báo cáo & Thống kê</h1>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button variant="outline" onClick={loadAllData}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Làm mới
                            </Button>
                            <Button variant="outline">
                                <Download className="h-4 w-4 mr-2" />
                                Xuất báo cáo
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="space-y-6">
                    {/* Date Range Filter */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Calendar className="h-5 w-5 mr-2" />
                                Khoảng thời gian báo cáo
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
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
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            const today = new Date();
                                            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                                            setDateRange({
                                                startDate: lastMonth.toISOString().split('T')[0],
                                                endDate: new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0]
                                            });
                                        }}
                                    >
                                        Tháng trước
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            const today = new Date();
                                            const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                                            setDateRange({
                                                startDate: thisMonth.toISOString().split('T')[0],
                                                endDate: today.toISOString().split('T')[0]
                                            });
                                        }}
                                    >
                                        Tháng này
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Key Metrics Overview */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Tổng doanh thu</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                    {helperUtils.formatCurrency(reportData.totalRevenue)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Kỳ này: {helperUtils.formatCurrency(reportData.periodRevenue)}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Chi phí sản xuất</CardTitle>
                                <Factory className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-orange-600">
                                    {helperUtils.formatCurrency(reportData.totalCost)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Kỳ này: {helperUtils.formatCurrency(reportData.periodCost)}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Lợi nhuận</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${reportData.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {helperUtils.formatCurrency(reportData.totalProfit)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Biên LN: {formatPercentage(reportData.profitMargin)}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Giá trị tồn kho</CardTitle>
                                <Package className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {helperUtils.formatCurrency(reportData.totalMaterialValue + reportData.totalProductValue)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {reportData.lowStockItems > 0 && (
                                        <span className="text-orange-600">{reportData.lowStockItems} mặt hàng sắp hết</span>
                                    )}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Detailed Reports */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
                            <TabsTrigger value="sales">Bán hàng</TabsTrigger>
                            <TabsTrigger value="production">Sản xuất</TabsTrigger>
                            <TabsTrigger value="inventory">Tồn kho</TabsTrigger>
                        </TabsList>

                        {/* Overview Tab */}
                        <TabsContent value="overview" className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Hoạt động tổng quan</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Tổng số lượng bán:</span>
                                            <span className="font-medium">{reportData.totalSales} sản phẩm</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Tổng sản xuất:</span>
                                            <span className="font-medium">{reportData.totalProduction} sản phẩm</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Vật tư nhập:</span>
                                            <span className="font-medium">{reportData.totalMaterialImports} đơn vị</span>
                                        </div>
                                        <Separator />
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Doanh thu kỳ này:</span>
                                            <span className="font-medium text-green-600">
                                                {helperUtils.formatCurrency(reportData.periodRevenue)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Lợi nhuận kỳ này:</span>
                                            <span className={`font-medium ${reportData.periodProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {helperUtils.formatCurrency(reportData.periodProfit)}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Giao dịch gần đây</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {recentTransactions.slice(0, 6).map((transaction) => (
                                                <div key={transaction.id} className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        {transaction.type === 'sale' && <ShoppingCart className="h-4 w-4 text-green-600" />}
                                                        {transaction.type === 'production' && <Factory className="h-4 w-4 text-blue-600" />}
                                                        {transaction.type === 'material_import' && <Package className="h-4 w-4 text-purple-600" />}
                                                        <span className="text-sm">{transaction.description}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`text-sm font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                                                            {transaction.amount >= 0 ? '+' : ''}{helperUtils.formatCurrency(Math.abs(transaction.amount))}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {helperUtils.formatTimeAgo(transaction.date)}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* Sales Tab */}
                        <TabsContent value="sales" className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Top sản phẩm bán chạy</CardTitle>
                                        <CardDescription>
                                            Theo doanh thu (tất cả thời gian)
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {reportData.topSellingProducts.map((product, index) => (
                                                <div key={index} className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <Badge variant="outline">{index + 1}</Badge>
                                                        <span className="font-medium">{product.productName}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-medium text-green-600">
                                                            {helperUtils.formatCurrency(product.revenue)}
                                                        </div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {product.quantitySold} sản phẩm
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Phân tích bán hàng</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Doanh thu trung bình/đơn:</span>
                                            <span className="font-medium">
                                                {sales.length > 0
                                                    ? helperUtils.formatCurrency(reportData.totalRevenue / sales.length)
                                                    : helperUtils.formatCurrency(0)
                                                }
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Tổng số đơn hàng:</span>
                                            <span className="font-medium">{sales.length} đơn</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Sản phẩm/đơn TB:</span>
                                            <span className="font-medium">
                                                {sales.length > 0
                                                    ? (reportData.totalSales / sales.length).toFixed(1)
                                                    : '0'
                                                }
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* Production Tab */}
                        <TabsContent value="production" className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Thống kê sản xuất</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Tổng chi phí sản xuất:</span>
                                            <span className="font-medium text-orange-600">
                                                {helperUtils.formatCurrency(reportData.totalCost)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Chi phí TB/sản phẩm:</span>
                                            <span className="font-medium">
                                                {reportData.totalProduction > 0
                                                    ? helperUtils.formatCurrency(reportData.totalCost / reportData.totalProduction)
                                                    : helperUtils.formatCurrency(0)
                                                }
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Số lần sản xuất:</span>
                                            <span className="font-medium">{productions.length} lần</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">SL TB/lần sản xuất:</span>
                                            <span className="font-medium">
                                                {productions.length > 0
                                                    ? (reportData.totalProduction / productions.length).toFixed(1)
                                                    : '0'
                                                } sản phẩm
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Chi phí vật tư</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Tổng nhập vật tư:</span>
                                            <span className="font-medium text-blue-600">
                                                {helperUtils.formatCurrency(
                                                    materialTransactions
                                                        .filter(t => t.type === 'import')
                                                        .reduce((sum, t) => sum + t.totalAmount, 0)
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Giá trị tồn kho vật tư:</span>
                                            <span className="font-medium">
                                                {helperUtils.formatCurrency(reportData.totalMaterialValue)}
                                            </span>
                                        </div>
                                        {reportData.lowStockItems > 0 && (
                                            <Alert>
                                                <AlertTriangle className="h-4 w-4" />
                                                <AlertDescription>
                                                    {reportData.lowStockItems} loại vật tư sắp hết ({"<"} 10 đơn vị)
                                                </AlertDescription>
                                            </Alert>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* Inventory Tab */}
                        <TabsContent value="inventory" className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Tồn kho vật tư</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {materials.slice(0, 8).map((material) => (
                                                <div key={material.id} className="flex items-center justify-between">
                                                    <span className="text-sm">{material.name}</span>
                                                    <div className="text-right">
                                                        <Badge
                                                            variant={material.currentStock < 10 ? "destructive" : "default"}
                                                        >
                                                            {material.currentStock} {material.unit}
                                                        </Badge>
                                                        <div className="text-xs text-muted-foreground">
                                                            {helperUtils.formatCurrency(material.currentStock * material.unitPrice)}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Tồn kho sản phẩm</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {products.slice(0, 8).map((product) => {
                                                const productProductions = productions.filter(p => p.productId === product.id);
                                                const avgCostPerUnit = productProductions.length > 0
                                                    ? productProductions.reduce((s, p) => s + p.costPerUnit, 0) / productProductions.length
                                                    : 0;
                                                const estimatedValue = product.currentStock * avgCostPerUnit;

                                                return (
                                                    <div key={product.id} className="flex items-center justify-between">
                                                        <span className="text-sm">{product.name}</span>
                                                        <div className="text-right">
                                                            <Badge
                                                                variant={product.currentStock === 0 ? "destructive" : "default"}
                                                            >
                                                                {product.currentStock} SP
                                                            </Badge>
                                                            <div className="text-xs text-muted-foreground">
                                                                {helperUtils.formatCurrency(estimatedValue)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Tóm tắt giá trị tồn kho</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="text-center p-4 border rounded-lg">
                                            <div className="text-2xl font-bold text-blue-600">
                                                {helperUtils.formatCurrency(reportData.totalMaterialValue)}
                                            </div>
                                            <div className="text-sm text-muted-foreground">Giá trị vật tư</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {materials.length} loại vật tư
                                            </div>
                                        </div>

                                        <div className="text-center p-4 border rounded-lg">
                                            <div className="text-2xl font-bold text-green-600">
                                                {helperUtils.formatCurrency(reportData.totalProductValue)}
                                            </div>
                                            <div className="text-sm text-muted-foreground">Giá trị sản phẩm</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {products.reduce((sum, p) => sum + p.currentStock, 0)} sản phẩm
                                            </div>
                                        </div>

                                        <div className="text-center p-4 border rounded-lg">
                                            <div className="text-2xl font-bold">
                                                {helperUtils.formatCurrency(reportData.totalMaterialValue + reportData.totalProductValue)}
                                            </div>
                                            <div className="text-sm text-muted-foreground">Tổng giá trị</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                Toàn bộ tồn kho
                                            </div>
                                        </div>
                                    </div>

                                    {reportData.lowStockItems > 0 && (
                                        <Alert className="mt-4">
                                            <AlertTriangle className="h-4 w-4" />
                                            <AlertDescription>
                                                <div className="font-medium">Cảnh báo tồn kho thấp:</div>
                                                <div className="mt-1">
                                                    {reportData.lowStockItems} loại vật tư có tồn kho dưới 10 đơn vị.
                                                    <Button variant="link" className="p-0 h-auto" onClick={() => router.push('/inventory')}>
                                                        Xem chi tiết →
                                                    </Button>
                                                </div>
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>

                    {/* Export & Actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Xuất báo cáo</CardTitle>
                            <CardDescription>
                                Tải xuống dữ liệu báo cáo cho khoảng thời gian đã chọn
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <Button variant="outline" className="justify-start">
                                    <Download className="h-4 w-4 mr-2" />
                                    Báo cáo tổng quan
                                </Button>
                                <Button variant="outline" className="justify-start">
                                    <Download className="h-4 w-4 mr-2" />
                                    Chi tiết bán hàng
                                </Button>
                                <Button variant="outline" className="justify-start">
                                    <Download className="h-4 w-4 mr-2" />
                                    Chi tiết sản xuất
                                </Button>
                                <Button variant="outline" className="justify-start">
                                    <Download className="h-4 w-4 mr-2" />
                                    Báo cáo tồn kho
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}