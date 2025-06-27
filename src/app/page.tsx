'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import {
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    where,
    Timestamp
} from 'firebase/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

import {
    Package,
    ShoppingCart,
    TrendingUp,
    AlertTriangle,
    Plus,
    Factory,
    BarChart3,
    Bell,
    Settings,
    LogOut,
    ChevronRight,
    DollarSign,
    Target,
    Activity,
    ArrowUp,
    Sparkles
} from 'lucide-react';

interface StatsData {
    totalMaterials: number;
    totalProducts: number;
    totalRevenue: number;
    totalProfit: number;
    lowStockItems: number;
    todaySales: number;
    totalCost: number;
}

interface RecentActivity {
    id: string;
    type: 'material_import' | 'production' | 'sale';
    description: string;
    timestamp: Date;
    amount?: number;
    status?: 'success' | 'warning' | 'info';
}

interface Material {
    id: string;
    name: string;
    currentStock: number;
    unit: string;
    unitPrice: number;
}

interface Product {
    id: string;
    name: string;
    currentStock: number;
    sellingPrice: number;
}

export default function DashboardPage() {
    const [user, loading] = useAuthState(auth);
    const [stats, setStats] = useState<StatsData>({
        totalMaterials: 0,
        totalProducts: 0,
        totalRevenue: 0,
        totalProfit: 0,
        lowStockItems: 0,
        todaySales: 0,
        totalCost: 0
    });
    const [lowStockMaterials, setLowStockMaterials] = useState<Material[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (user) {
            loadDashboardData();
        }
    }, [user]);

    const loadDashboardData = async () => {
        try {
            setIsLoading(true);

            // Load materials stats
            const materialsSnapshot = await getDocs(collection(db, 'materials'));
            const materials = materialsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Material[];

            // Load products stats  
            const productsSnapshot = await getDocs(collection(db, 'products'));
            const products = productsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Product[];

            // Load today's sales
            const today = new Date();
            const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

            const todaySalesQuery = query(
                collection(db, 'sales'),
                where('createdAt', '>=', Timestamp.fromDate(startOfToday)),
                where('createdAt', '<', Timestamp.fromDate(endOfToday))
            );
            const todaySalesSnapshot = await getDocs(todaySalesQuery);

            let todayRevenue = 0;
            todaySalesSnapshot.docs.forEach(doc => {
                const sale = doc.data();
                todayRevenue += sale.totalRevenue || 0;
            });

            // Load total revenue and calculate profit
            const allSalesSnapshot = await getDocs(collection(db, 'sales'));
            let totalRevenue = 0;
            allSalesSnapshot.docs.forEach(doc => {
                const sale = doc.data();
                totalRevenue += sale.totalRevenue || 0;
            });

            // Load total production cost
            const productionLogsSnapshot = await getDocs(collection(db, 'production_logs'));
            let totalCost = 0;
            productionLogsSnapshot.docs.forEach(doc => {
                const log = doc.data();
                totalCost += log.totalCost || 0;
            });

            // Find low stock items (less than 10 units)
            const lowStock = materials.filter(material => material.currentStock < 10);

            // Load recent activities
            const recentActivitiesData = await loadRecentActivities();

            setStats({
                totalMaterials: materials.length,
                totalProducts: products.length,
                totalRevenue,
                totalProfit: totalRevenue - totalCost,
                lowStockItems: lowStock.length,
                todaySales: todayRevenue,
                totalCost
            });

            setLowStockMaterials(lowStock.slice(0, 5)); 

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            // Fallback to mock data for development
            setStats({
                totalMaterials: 15,
                totalProducts: 8,
                totalRevenue: 45000000,
                totalProfit: 12000000,
                lowStockItems: 3,
                todaySales: 2500000,
                totalCost: 33000000
            });
        } finally {
            setIsLoading(false);
        }
    };

    const loadRecentActivities = async (): Promise<RecentActivity[]> => {
        const activities: RecentActivity[] = [];

        try {
            // Load recent sales
            const salesQuery = query(
                collection(db, 'sales'),
                orderBy('createdAt', 'desc'),
                limit(5)
            );
            const salesSnapshot = await getDocs(salesQuery);

            salesSnapshot.docs.forEach(doc => {
                const sale = doc.data();
                activities.push({
                    id: doc.id,
                    type: 'sale',
                    description: `Bán ${sale.quantity} ${sale.productName}`,
                    timestamp: sale.createdAt.toDate(),
                    amount: sale.totalRevenue,
                    status: 'success'
                });
            });

            // Load recent production
            const productionQuery = query(
                collection(db, 'production_logs'),
                orderBy('createdAt', 'desc'),
                limit(3)
            );
            const productionSnapshot = await getDocs(productionQuery);

            productionSnapshot.docs.forEach(doc => {
                const production = doc.data();
                activities.push({
                    id: doc.id,
                    type: 'production',
                    description: `Đóng gói ${production.quantityProduced} ${production.productName}`,
                    timestamp: production.createdAt.toDate(),
                    status: 'info'
                });
            });

            // Load recent material imports
            const materialQuery = query(
                collection(db, 'material_transactions'),
                where('type', '==', 'import'),
                orderBy('createdAt', 'desc'),
                limit(3)
            );
            const materialSnapshot = await getDocs(materialQuery);

            materialSnapshot.docs.forEach(doc => {
                const transaction = doc.data();
                activities.push({
                    id: doc.id,
                    type: 'material_import',
                    description: `Nhập ${transaction.quantity} ${transaction.materialName}`,
                    timestamp: transaction.createdAt.toDate(),
                    status: 'info'
                });
            });

            // Sort by timestamp and return top 10
            return activities
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                .slice(0, 10);

        } catch (error) {
            console.error('Error loading recent activities:', error);
            return [];
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push('/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    };

    const formatTimeAgo = (date: Date) => {
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

        if (diffInMinutes < 60) {
            return `${diffInMinutes} phút trước`;
        } else if (diffInMinutes < 1440) {
            return `${Math.floor(diffInMinutes / 60)} giờ trước`;
        } else {
            return `${Math.floor(diffInMinutes / 1440)} ngày trước`;
        }
    };

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'sale':
                return <ShoppingCart className="h-4 w-4 text-green-600" />;
            case 'production':
                return <Factory className="h-4 w-4 text-blue-600" />;
            case 'material_import':
                return <Package className="h-4 w-4 text-purple-600" />;
            default:
                return <Package className="h-4 w-4 text-gray-600" />;
        }
    };

    const getStatusBadge = (status?: string) => {
        switch (status) {
            case 'success':
                return <Badge variant="default">Thành công</Badge>;
            case 'warning':
                return <Badge variant="destructive">Cảnh báo</Badge>;
            case 'info':
                return <Badge variant="secondary">Thông tin</Badge>;
            default:
                return null;
        }
    };

    if (loading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto"></div>
                    <p className="text-lg font-medium text-muted-foreground">Đang tải dữ liệu...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-white/20 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:bg-slate-900/80 dark:supports-[backdrop-filter]:bg-slate-900/60">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex h-20 items-center justify-between">
                        <div className="flex items-center space-x-6">
                            <div className="flex items-center space-x-3">
                                <div className="relative">
                                    <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                                        <Package className="h-7 w-7 text-white" />
                                    </div>
                                    <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full flex items-center justify-center">
                                        <Sparkles className="h-2.5 w-2.5 text-white" />
                                    </div>
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                        Quản lý vật tư
                                    </h1>
                                    <p className="text-sm text-muted-foreground">Hệ thống quản lý thông minh</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            <Button variant="ghost" size="icon" className="relative hover:bg-white/50 dark:hover:bg-slate-800/50">
                                <Bell className="h-5 w-5" />
                                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span>
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-white/50 dark:hover:bg-slate-800/50">
                                        <Avatar className="h-10 w-10 border-2 border-white/20">
                                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white font-semibold">
                                                {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                                            </AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-64" align="end" forceMount>
                                    <div className="flex items-center justify-start gap-3 p-4">
                                        <Avatar className="h-12 w-12">
                                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white font-semibold">
                                                {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col space-y-1 leading-none">
                                            <p className="font-semibold">{user.displayName || 'Người dùng'}</p>
                                            <p className="w-[180px] truncate text-sm text-muted-foreground">
                                                {user.email}
                                            </p>
                                        </div>
                                    </div>
                                    <Separator />
                                    <DropdownMenuItem className="py-3">
                                        <Settings className="mr-3 h-4 w-4" />
                                        <span>Cài đặt</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleLogout} className="py-3 text-red-600 focus:text-red-600">
                                        <LogOut className="mr-3 h-4 w-4" />
                                        <span>Đăng xuất</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Welcome Section */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                                Chào mừng trở lại! 👋
                            </h2>
                            <p className="text-lg text-muted-foreground mt-1">
                                Hôm nay là ngày tốt để tối ưu hóa doanh nghiệp của bạn
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">Hôm nay</p>
                            <p className="text-2xl font-bold text-green-600">
                                {formatCurrency(stats.todaySales)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Enhanced Stats Grid */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
                    <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-transparent"></div>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                            <CardTitle className="text-sm font-medium text-blue-100">Tổng vật tư</CardTitle>
                            <div className="p-2 bg-white/20 rounded-lg">
                                <Package className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent className="relative">
                            <div className="text-3xl font-bold mb-1">{stats.totalMaterials}</div>
                            <div className="flex items-center text-sm text-blue-100">
                                <ArrowUp className="h-4 w-4 mr-1" />
                                {/* <span>+12% từ tháng trước</span> */}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-transparent"></div>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                            <CardTitle className="text-sm font-medium text-purple-100">Thành phẩm</CardTitle>
                            <div className="p-2 bg-white/20 rounded-lg">
                                <Factory className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent className="relative">
                            <div className="text-3xl font-bold mb-1">{stats.totalProducts}</div>
                            <div className="flex items-center text-sm text-purple-100">
                                <ArrowUp className="h-4 w-4 mr-1" />
                                {/* <span>+8% từ tháng trước</span> */}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-green-500 to-green-600 text-white">
                        <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-transparent"></div>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                            <CardTitle className="text-sm font-medium text-green-100">Doanh thu</CardTitle>
                            <div className="p-2 bg-white/20 rounded-lg">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent className="relative">
                            <div className="text-2xl font-bold mb-1">{formatCurrency(stats.totalRevenue)}</div>
                            {/* <div className="flex items-center text-sm text-green-100">
                                <ArrowUp className="h-4 w-4 mr-1" />
                                <span>+15% từ tháng trước</span>
                            </div> */}
                        </CardContent>
                    </Card>

                    <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-orange-500 to-red-500 text-white">
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-transparent"></div>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                            <CardTitle className="text-sm font-medium text-orange-100">Cảnh báo tồn</CardTitle>
                            <div className="p-2 bg-white/20 rounded-lg">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent className="relative">
                            <div className="text-3xl font-bold mb-1">{stats.lowStockItems}</div>
                            <div className="flex items-center text-sm text-orange-100">
                                <AlertTriangle className="h-4 w-4 mr-1" />
                                <span>Cần xử lý ngay</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Enhanced Two Column Layout */}
                <div className="grid gap-8 lg:grid-cols-3">
                    {/* Quick Actions - Enhanced */}
                    <Card className="lg:col-span-1 border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
                        <CardHeader className="pb-4">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg">
                                    <Activity className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl">Thao tác nhanh</CardTitle>
                                    <CardDescription>Các chức năng thường dùng</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button
                                className="w-full justify-start h-14 text-left bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-lg"
                                onClick={() => router.push('/materials/import')}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-white/20 rounded-lg">
                                        <Plus className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="font-semibold">Nhập vật tư mới</div>
                                        <div className="text-sm text-blue-100">Cập nhật kho hàng</div>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 ml-auto" />
                            </Button>

                            <Button
                                className="w-full justify-start h-14 text-left bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white border-0 shadow-lg"
                                onClick={() => router.push('/products')}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-white/20 rounded-lg">
                                        <Factory className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="font-semibold">Đóng gói sản phẩm</div>
                                        <div className="text-sm text-purple-100">Quản lý sản xuất</div>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 ml-auto" />
                            </Button>

                            <Button
                                className="w-full justify-start h-14 text-left bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white border-0 shadow-lg"
                                onClick={() => router.push('/sales/new')}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-white/20 rounded-lg">
                                        <ShoppingCart className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="font-semibold">Ghi nhận bán hàng</div>
                                        <div className="text-sm text-green-100">Tăng doanh thu</div>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 ml-auto" />
                            </Button>

                            <Button
                                className="w-full justify-start h-14 text-left bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-0 shadow-lg"
                                onClick={() => router.push('/reports')}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-white/20 rounded-lg">
                                        <BarChart3 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="font-semibold">Xem báo cáo</div>
                                        <div className="text-sm text-orange-100">Phân tích dữ liệu</div>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 ml-auto" />
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Performance Metrics */}
                    <Card className="lg:col-span-2 border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-gradient-to-br from-green-500 to-blue-500 rounded-lg">
                                        <Target className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl">Hiệu suất kinh doanh</CardTitle>
                                        <CardDescription>Tổng quan về tình hình tài chính</CardDescription>
                                    </div>
                                </div>
                                {/* <Button variant="outline" size="sm">
                                    Xem chi tiết
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button> */}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl">
                                        <div>
                                            <p className="text-sm font-medium text-green-700 dark:text-green-300">Lợi nhuận</p>
                                            <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                                                {formatCurrency(stats.totalProfit)}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-green-500 rounded-lg">
                                            <DollarSign className="h-6 w-6 text-white" />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl">
                                        <div>
                                            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Tổng chi phí</p>
                                            <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                                                {formatCurrency(stats.totalCost)}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-blue-500 rounded-lg">
                                            <TrendingUp className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Tỷ lệ lợi nhuận</p>
                                            <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                                {((stats.totalProfit / stats.totalRevenue) * 100).toFixed(1)}%
                                            </Badge>
                                        </div>
                                        <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-3">
                                            <div 
                                                className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-1000 ease-out"
                                                style={{ width: `${(stats.totalProfit / stats.totalRevenue) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    {/* <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Hiệu quả vận hành</p>
                                            <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                                                Tốt
                                            </Badge>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className="flex-1 bg-orange-200 dark:bg-orange-800 rounded-full h-3">
                                                <div className="bg-gradient-to-r from-orange-500 to-red-500 h-3 rounded-full w-4/5 transition-all duration-1000 ease-out"></div>
                                            </div>
                                            <span className="text-sm font-medium text-orange-700 dark:text-orange-300">80%</span>
                                        </div>
                                    </div> */}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Enhanced Low Stock Alert */}
                {lowStockMaterials.length > 0 && (
                    <Card className="mt-8 border-0 shadow-xl overflow-hidden bg-gradient-to-r from-orange-50 via-red-50 to-pink-50 dark:from-orange-900/20 dark:via-red-900/20 dark:to-pink-900/20">
                        <CardHeader className="pb-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-lg">
                                        <AlertTriangle className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl text-orange-800 dark:text-orange-200 flex items-center">
                                            Cảnh báo tồn kho thấp
                                            {stats.lowStockItems > 0 && (
                                                <Badge variant="destructive" className="ml-3">
                                                    {stats.lowStockItems} mục
                                                </Badge>
                                            )}
                                        </CardTitle>
                                        <CardDescription className="text-orange-700 dark:text-orange-300">
                                            Các vật tư sau đây cần được nhập thêm để đảm bảo sản xuất liên tục
                                        </CardDescription>
                                    </div>
                                </div>
                                <Button 
                                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0 shadow-lg"
                                    onClick={() => router.push('/materials/import')}
                                >
                                    Nhập ngay
                                    <Plus className="h-4 w-4 ml-2" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {lowStockMaterials.map((material, index) => (
                                    <div 
                                        key={material.id} 
                                        className="group relative p-4 bg-white dark:bg-slate-800 rounded-xl border border-orange-200 dark:border-orange-800 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                                        style={{
                                            animationDelay: `${index * 100}ms`,
                                            animation: 'slideInUp 0.6s ease-out forwards'
                                        }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-gray-900 dark:text-white group-hover:text-orange-600 transition-colors">
                                                    {material.name}
                                                </h4>
                                                <div className="flex items-center space-x-2 mt-2">
                                                    <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
                                                        <Package className="h-4 w-4" />
                                                        <span>Còn: {material.currentStock} {material.unit}</span>
                                                    </div>
                                                </div>
                                                <div className="mt-3">
                                                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                        <span>Mức tồn kho</span>
                                                        <span>{material.currentStock}/50</span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                        <div 
                                                            className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-1000 ease-out"
                                                            style={{ width: `${Math.min((material.currentStock / 50) * 100, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="ml-4">
                                                <Badge 
                                                    variant="outline" 
                                                    className="text-orange-600 border-orange-600 bg-orange-50 dark:bg-orange-900/20 whitespace-nowrap"
                                                >
                                                    {material.currentStock < 5 ? 'Khẩn cấp' : 'Sắp hết'}
                                                </Badge>
                                            </div>
                                        </div>
                                        
                                        {/* Pulse effect for critical items */}
                                        {material.currentStock < 5 && (
                                            <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl opacity-20 animate-pulse"></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            
                            {lowStockMaterials.length > 3 && (
                                <div className="mt-6 text-center">
                                    <Button 
                                        variant="outline" 
                                        className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/20"
                                        onClick={() => router.push('/materials')}
                                    >
                                        Xem tất cả vật tư sắp hết ({stats.lowStockItems})
                                        <ChevronRight className="h-4 w-4 ml-2" />
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </main>

            {/* Custom animations */}
            <style jsx>{`
                @keyframes slideInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    )}