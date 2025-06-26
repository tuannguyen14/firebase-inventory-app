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
    ChevronRight
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
    const [user, loading, error] = useAuthState(auth);
    const [stats, setStats] = useState<StatsData>({
        totalMaterials: 0,
        totalProducts: 0,
        totalRevenue: 0,
        totalProfit: 0,
        lowStockItems: 0,
        todaySales: 0,
        totalCost: 0
    });
    const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
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

            setLowStockMaterials(lowStock.slice(0, 5)); // Show only top 5
            setRecentActivities(recentActivitiesData);

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

            setRecentActivities([
                {
                    id: '1',
                    type: 'sale',
                    description: 'Bán 12 thùng dầu ăn cao cấp',
                    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
                    amount: 1800000,
                    status: 'success'
                },
                {
                    id: '2',
                    type: 'production',
                    description: 'Đóng gói 24 thùng sản phẩm mới',
                    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
                    status: 'info'
                },
                {
                    id: '3',
                    type: 'material_import',
                    description: 'Nhập 500 chai thủy tinh',
                    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                    status: 'info'
                }
            ]);
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
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                                <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                                    <Package className="h-5 w-5 text-primary-foreground" />
                                </div>
                                <h1 className="text-xl font-semibold">Quản lý vật tư</h1>
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            <Button variant="ghost" size="icon">
                                <Bell className="h-5 w-5" />
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                        <Avatar className="h-8 w-8">
                                            {/* <AvatarInitials> */}
                                            {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                                            {/* </AvatarInitials> */}
                                            <AvatarFallback>U</AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56" align="end" forceMount>
                                    <div className="flex items-center justify-start gap-2 p-2">
                                        <div className="flex flex-col space-y-1 leading-none">
                                            <p className="font-medium">{user.displayName || 'Người dùng'}</p>
                                            <p className="w-[200px] truncate text-sm text-muted-foreground">
                                                {user.email}
                                            </p>
                                        </div>
                                    </div>
                                    <Separator />
                                    <DropdownMenuItem>
                                        <Settings className="mr-2 h-4 w-4" />
                                        <span>Cài đặt</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleLogout}>
                                        <LogOut className="mr-2 h-4 w-4" />
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
                {/* Stats Grid */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tổng vật tư</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalMaterials}</div>
                            <p className="text-xs text-muted-foreground">
                                Các loại vật tư khác nhau
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Thành phẩm</CardTitle>
                            <Factory className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalProducts}</div>
                            <p className="text-xs text-muted-foreground">
                                Các sản phẩm có sẵn
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Doanh thu</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
                            <p className="text-xs text-muted-foreground">
                                Hôm nay: {formatCurrency(stats.todaySales)}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Cảnh báo tồn</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-600">{stats.lowStockItems}</div>
                            <p className="text-xs text-muted-foreground">
                                Vật tư sắp hết
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-8 md:grid-cols-12">
                    {/* Quick Actions */}
                    <Card className="md:col-span-4">
                        <CardHeader>
                            <CardTitle>Thao tác nhanh</CardTitle>
                            <CardDescription>
                                Các chức năng thường dùng
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button
                                className="w-full justify-start"
                                variant="outline"
                                onClick={() => router.push('/materials/import')}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Nhập vật tư mới
                            </Button>

                            <Button
                                className="w-full justify-start"
                                variant="outline"
                                onClick={() => router.push('/products')}
                            >
                                <Factory className="mr-2 h-4 w-4" />
                                Đóng gói sản phẩm
                            </Button>

                            <Button
                                className="w-full justify-start"
                                variant="outline"
                                onClick={() => router.push('/sales/new')}
                            >
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                Ghi nhận bán hàng
                            </Button>

                            <Button
                                className="w-full justify-start"
                                variant="outline"
                                onClick={() => router.push('/reports')}
                            >
                                <BarChart3 className="mr-2 h-4 w-4" />
                                Xem báo cáo
                            </Button>
                        </CardContent>
                    </Card>

                </div>

                {/* Low Stock Alert */}
                {lowStockMaterials.length > 0 && (
                    <Card className="mt-8 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                        <CardHeader>
                            <div className="flex items-center space-x-2">
                                <AlertTriangle className="h-5 w-5 text-orange-600" />
                                <CardTitle className="text-orange-800 dark:text-orange-200">
                                    Cảnh báo tồn kho thấp
                                </CardTitle>
                            </div>
                            <CardDescription className="text-orange-700 dark:text-orange-300">
                                Các vật tư sau đây sắp hết, cần nhập thêm
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                {lowStockMaterials.map((material) => (
                                    <div key={material.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-950 rounded-lg border">
                                        <div>
                                            <p className="font-medium">{material.name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                Còn: {material.currentStock} {material.unit}
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="text-orange-600 border-orange-600">
                                            Sắp hết
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </main>
        </div>
    );
}