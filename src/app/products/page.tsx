'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { 
  Product, 
  Material,
  productsUtils, 
  materialsUtils,
  helperUtils 
} from '@/lib/firebase-utils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Package, 
  Plus, 
  Search,
  Edit,
  Trash2,
  Factory,
  AlertTriangle,
  CheckCircle,
  Eye,
  TrendingUp,
  DollarSign,
  Activity,
  Filter,
  BarChart3,
  Sparkles,
  X,
  ShoppingCart,
  Layers,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';

export default function ProductsPage() {
  const [user, loading] = useAuthState(auth);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'instock' | 'outofstock' | 'canproduce'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'profit' | 'price'>('name');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    filterAndSortProducts();
  }, [products, searchTerm, stockFilter, sortBy, materials]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [productsData, materialsData] = await Promise.all([
        productsUtils.getAll(),
        materialsUtils.getAll()
      ]);
      setProducts(productsData);
      setMaterials(materialsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Không thể tải dữ liệu');
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortProducts = () => {
    let filtered = products;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply stock filter
    if (stockFilter !== 'all') {
      filtered = filtered.filter(product => {
        const capacity = calculateProductionCapacity(product);
        switch (stockFilter) {
          case 'instock':
            return product.currentStock > 0;
          case 'outofstock':
            return product.currentStock === 0;
          case 'canproduce':
            return capacity.canProduce > 0;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'stock':
          return b.currentStock - a.currentStock;
        case 'price':
          return b.sellingPrice - a.sellingPrice;
        case 'profit':
          const profitA = a.sellingPrice - getProductCost(a);
          const profitB = b.sellingPrice - getProductCost(b);
          return profitB - profitA;
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    setFilteredProducts(filtered);
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    try {
      setIsDeleting(true);
      await productsUtils.delete(productId);
      toast.success(`Đã xóa sản phẩm: ${productName}`);
      await loadData();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Có lỗi xảy ra khi xóa sản phẩm');
    } finally {
      setIsDeleting(false);
    }
  };

  const calculateProductionCapacity = (product: Product) => {
    const materialMap = new Map(materials.map(m => [m.id!, m]));
    let canProduce = Infinity;
    const missingMaterials: string[] = [];

    for (const ingredient of product.formula) {
      const material = materialMap.get(ingredient.materialId);
      if (!material) {
        missingMaterials.push(ingredient.materialName);
        canProduce = 0;
        continue;
      }

      const possibleQuantity = Math.floor(material.currentStock / ingredient.quantity);
      canProduce = Math.min(canProduce, possibleQuantity);
    }

    return {
      canProduce: canProduce === Infinity ? 0 : canProduce,
      missingMaterials
    };
  };

  const getProductCost = (product: Product) => {
    const materialMap = new Map(materials.map(m => [m.id!, m]));
    return product.formula.reduce((total, ingredient) => {
      const material = materialMap.get(ingredient.materialId);
      return total + (material ? material.unitPrice * ingredient.quantity : 0);
    }, 0);
  };

  const getStockStats = () => {
    const inStock = products.filter(p => p.currentStock > 0).length;
    const outOfStock = products.filter(p => p.currentStock === 0).length;
    const canProduce = products.filter(p => calculateProductionCapacity(p).canProduce > 0).length;
    const totalValue = products.reduce((sum, p) => sum + (p.currentStock * p.sellingPrice), 0);

    return { inStock, outOfStock, canProduce, totalValue };
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

  const stats = getStockStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Enhanced Header */}
      <header className="sticky top-0 z-50 border-b border-white/20 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:bg-slate-900/80 dark:supports-[backdrop-filter]:bg-slate-900/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="h-12 w-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Package className="h-7 w-7 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 h-4 w-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <Sparkles className="h-2.5 w-2.5 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Quản lý sản phẩm
                  </h1>
                  <p className="text-sm text-muted-foreground">Theo dõi và quản lý sản phẩm</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="bg-white/50 dark:bg-slate-800/50">
                {products.length} sản phẩm
              </Badge>
              <Button 
                onClick={() => router.push('/products/new')}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <Plus className="h-4 w-4 mr-2" />
                Tạo sản phẩm mới
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Stats Overview */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                    <Package className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Có hàng</p>
                    <p className="text-2xl font-bold">{stats.inStock}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl">
                    <AlertTriangle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Hết hàng</p>
                    <p className="text-2xl font-bold text-orange-600">{stats.outOfStock}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                    <Factory className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Có thể SX</p>
                    <p className="text-2xl font-bold text-green-600">{stats.canProduce}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Giá trị kho</p>
                    <p className="text-2xl font-bold">{helperUtils.formatCurrency(stats.totalValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filters */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm kiếm sản phẩm..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-12"
                  />
                </div>
                
                <Select value={stockFilter} onValueChange={(value: any) => setStockFilter(value)}>
                  <SelectTrigger className="w-48 h-12">
                    <div className="flex items-center">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả sản phẩm</SelectItem>
                    <SelectItem value="instock">Còn hàng</SelectItem>
                    <SelectItem value="outofstock">Hết hàng</SelectItem>
                    <SelectItem value="canproduce">Có thể sản xuất</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-48 h-12">
                    <div className="flex items-center">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Sắp xếp theo tên</SelectItem>
                    <SelectItem value="stock">Sắp xếp theo tồn kho</SelectItem>
                    <SelectItem value="price">Sắp xếp theo giá</SelectItem>
                    <SelectItem value="profit">Sắp xếp theo lợi nhuận</SelectItem>
                  </SelectContent>
                </Select>

                <Button 
                  variant="outline" 
                  onClick={loadData}
                  className="h-12 px-6 hover:bg-blue-50 dark:hover:bg-slate-800"
                >
                  Làm mới
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-3">
            <Button
              variant="outline"
              onClick={() => router.push('/products/new')}
              className="h-24 flex-col space-y-3 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 dark:from-blue-900/20 dark:to-blue-800/20 border-0 shadow-lg"
            >
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                <Factory className="h-6 w-6 text-white" />
              </div>
              <div className="text-center">
                <div className="font-semibold">Đóng gói sản phẩm</div>
                <div className="text-sm opacity-70">Sản xuất từ vật tư</div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push('/sales/new')}
              className="h-24 flex-col space-y-3 bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 dark:from-green-900/20 dark:to-green-800/20 border-0 shadow-lg"
            >
              <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
                <ShoppingCart className="h-6 w-6 text-white" />
              </div>
              <div className="text-center">
                <div className="font-semibold">Bán hàng</div>
                <div className="text-sm opacity-70">Ghi nhận doanh thu</div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push('/products/new')}
              className="h-24 flex-col space-y-3 bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 dark:from-purple-900/20 dark:to-purple-800/20 border-0 shadow-lg"
            >
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                <Plus className="h-6 w-6 text-white" />
              </div>
              <div className="text-center">
                <div className="font-semibold">Thêm sản phẩm</div>
                <div className="text-sm opacity-70">Tạo công thức mới</div>
              </div>
            </Button>
          </div>

          {/* Products List */}
          {filteredProducts.length === 0 ? (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
              <CardContent className="text-center py-16">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="p-4 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-full w-24 h-24 flex items-center justify-center mx-auto">
                    <Package className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold">
                    {searchTerm || stockFilter !== 'all' ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm nào'}
                  </h3>
                  <p className="text-muted-foreground">
                    {searchTerm || stockFilter !== 'all'
                      ? 'Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm' 
                      : 'Tạo sản phẩm đầu tiên để bắt đầu quản lý sản xuất và bán hàng'
                    }
                  </p>
                  {!searchTerm && stockFilter === 'all' && (
                    <Button 
                      onClick={() => router.push('/products/new')}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Tạo sản phẩm mới
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product, index) => {
                const capacity = calculateProductionCapacity(product);
                const cost = getProductCost(product);
                const profit = product.sellingPrice - cost;
                const profitMargin = product.sellingPrice > 0 ? (profit / product.sellingPrice) * 100 : 0;

                return (
                  <Card 
                    key={product.id} 
                    className="group relative border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-slate-800/80 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                    style={{
                      animationDelay: `${index * 100}ms`,
                      animation: 'slideInUp 0.6s ease-out forwards'
                    }}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1 min-w-0">
                          <CardTitle className="text-lg truncate group-hover:text-purple-600 transition-colors">
                            {product.name}
                          </CardTitle>
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant={product.currentStock > 0 ? "default" : "destructive"}
                              className={product.currentStock > 0 
                                ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300" 
                                : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                              }
                            >
                              Tồn: {product.currentStock}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={capacity.canProduce > 0 
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" 
                                : "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300"
                              }
                            >
                              SX: {capacity.canProduce}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedProduct(product)}
                            className="h-8 w-8 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/20"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/products/edit?id=${product.id}`)}
                            className="h-8 w-8 hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/20"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20"
                                disabled={isDeleting}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Xác nhận xóa sản phẩm</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Bạn có chắc chắn muốn xóa sản phẩm "{product.name}"? 
                                  Hành động này không thể hoàn tác.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteProduct(product.id!, product.name)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Xóa
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Pricing Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg">
                          <div className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-1">Chi phí</div>
                          <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                            {helperUtils.formatCurrency(cost)}
                          </div>
                        </div>
                        <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
                          <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Giá bán</div>
                          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {helperUtils.formatCurrency(product.sellingPrice)}
                          </div>
                        </div>
                      </div>

                      {/* Profit Analysis */}
                      <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div className="text-xs font-medium text-green-700 dark:text-green-300">Lợi nhuận</div>
                          <Badge 
                            variant="outline" 
                            className={`${profit >= 0 
                              ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/20 dark:text-green-300' 
                              : 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/20 dark:text-red-300'
                            }`}
                          >
                            {profitMargin.toFixed(1)}%
                          </Badge>
                        </div>
                        <div className={`text-lg font-bold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {helperUtils.formatCurrency(profit)}
                        </div>
                      </div>

                      {/* Production Alert */}
                      {capacity.canProduce === 0 && (
                        <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          <AlertDescription className="text-xs text-orange-800 dark:text-orange-200">
                            Không thể sản xuất - thiếu vật tư
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Formula Preview */}
                      <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">
                            Công thức ({product.formula.length} vật tư)
                          </span>
                        </div>
                        <div className="space-y-1">
                          {product.formula.slice(0, 2).map((ingredient, idx) => (
                            <div key={idx} className="text-xs flex justify-between items-center">
                              <span className="text-gray-700 dark:text-gray-300">{ingredient.materialName}</span>
                              <Badge variant="outline" className="text-xs">
                                {ingredient.quantity}
                              </Badge>
                            </div>
                          ))}
                          {product.formula.length > 2 && (
                            <div className="text-xs text-muted-foreground text-center pt-1">
                              +{product.formula.length - 2} vật tư khác...
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/sales/new?product=${product.id}`)}
                          disabled={product.currentStock === 0}
                          className="flex-1 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800"
                        >
                          <ShoppingCart className="h-3 w-3 mr-1" />
                          Bán hàng
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedProduct(product)}
                          className="bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>

                    {/* Gradient border effect */}
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-xl"></div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Product Detail Modal */}
          {selectedProduct && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <Card className="max-w-4xl w-full max-h-[90vh] overflow-hidden border-0 shadow-2xl bg-white/95 backdrop-blur-sm dark:bg-slate-900/95">
                <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <Package className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{selectedProduct.name}</CardTitle>
                        <CardDescription className="text-purple-100">
                          Chi tiết thông tin sản phẩm
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedProduct(null)}
                      className="hover:bg-white/20 text-white"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </CardHeader>

                <div className="max-h-[calc(90vh-120px)] overflow-y-auto">
                  <CardContent className="p-6 space-y-6">
                    {/* Overview Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {selectedProduct.currentStock}
                        </div>
                        <div className="text-sm text-blue-700 dark:text-blue-300">Tồn kho</div>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-800/20 rounded-xl">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {calculateProductionCapacity(selectedProduct).canProduce}
                        </div>
                        <div className="text-sm text-green-700 dark:text-green-300">Có thể SX</div>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {helperUtils.formatCurrency(selectedProduct.sellingPrice)}
                        </div>
                        <div className="text-sm text-purple-700 dark:text-purple-300">Giá bán</div>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl">
                        <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                          {selectedProduct.formula.length}
                        </div>
                        <div className="text-sm text-orange-700 dark:text-orange-300">Vật tư</div>
                      </div>
                    </div>

                    <Separator />

                    {/* Formula Details */}
                    <div>
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
                          <Layers className="h-5 w-5 text-white" />
                        </div>
                        <h4 className="text-lg font-semibold">Công thức sản xuất chi tiết</h4>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {selectedProduct.formula.map((ingredient, index) => {
                          const material = materials.find(m => m.id === ingredient.materialId);
                          const itemCost = material ? material.unitPrice * ingredient.quantity : 0;
                          const availableStock = material?.currentStock || 0;
                          const isAvailable = availableStock >= ingredient.quantity;

                          return (
                            <div 
                              key={index} 
                              className={`p-4 rounded-xl border-2 transition-all ${
                                isAvailable 
                                  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' 
                                  : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <h5 className="font-semibold text-gray-900 dark:text-white">
                                      {ingredient.materialName}
                                    </h5>
                                    <Badge variant={isAvailable ? "default" : "destructive"}>
                                      {isAvailable ? 'Đủ' : 'Thiếu'}
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground space-y-1">
                                    <div>Cần: {ingredient.quantity} {material?.unit || ''}</div>
                                    <div>Có: {availableStock} {material?.unit || ''}</div>
                                    <div>Đơn giá: {helperUtils.formatCurrency(material?.unitPrice || 0)}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                                    {helperUtils.formatCurrency(itemCost)}
                                  </div>
                                  <div className="text-sm text-muted-foreground">Chi phí</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Separator />

                    {/* Financial Analysis */}
                    <div>
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-white" />
                        </div>
                        <h4 className="text-lg font-semibold">Phân tích tài chính</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-6 border-2 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20 rounded-xl text-center">
                          <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                            {helperUtils.formatCurrency(getProductCost(selectedProduct))}
                          </div>
                          <div className="text-sm font-medium text-orange-700 dark:text-orange-300">Chi phí sản xuất</div>
                          <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                            Tổng chi phí vật tư
                          </div>
                        </div>
                        <div className="p-6 border-2 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 rounded-xl text-center">
                          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                            {helperUtils.formatCurrency(selectedProduct.sellingPrice)}
                          </div>
                          <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Giá bán</div>
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            Giá bán cho khách hàng
                          </div>
                        </div>
                        <div className="p-6 border-2 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 rounded-xl text-center">
                          <div className={`text-3xl font-bold mb-2 ${
                            (selectedProduct.sellingPrice - getProductCost(selectedProduct)) >= 0 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {helperUtils.formatCurrency(selectedProduct.sellingPrice - getProductCost(selectedProduct))}
                          </div>
                          <div className="text-sm font-medium text-green-700 dark:text-green-300">Lợi nhuận</div>
                          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                            {(((selectedProduct.sellingPrice - getProductCost(selectedProduct)) / selectedProduct.sellingPrice) * 100).toFixed(1)}% margin
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Production Capacity */}
                    <div>
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg">
                          <Activity className="h-5 w-5 text-white" />
                        </div>
                        <h4 className="text-lg font-semibold">Khả năng sản xuất</h4>
                      </div>
                      <div className="p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-lg font-medium">Có thể sản xuất tối đa:</span>
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant={calculateProductionCapacity(selectedProduct).canProduce > 0 ? "default" : "destructive"}
                              className="text-lg px-4 py-2"
                            >
                              {calculateProductionCapacity(selectedProduct).canProduce} sản phẩm
                            </Badge>
                            {calculateProductionCapacity(selectedProduct).canProduce > 0 ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-red-500" />
                            )}
                          </div>
                        </div>
                        
                        {calculateProductionCapacity(selectedProduct).missingMaterials.length > 0 && (
                          <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-800 dark:text-red-200">
                              <strong>Thiếu vật tư:</strong> {calculateProductionCapacity(selectedProduct).missingMaterials.join(', ')}
                            </AlertDescription>
                          </Alert>
                        )}

                        {calculateProductionCapacity(selectedProduct).canProduce > 0 && (
                          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <div className="flex items-center space-x-2 mb-2">
                              <Zap className="h-4 w-4 text-green-600" />
                              <span className="font-medium text-green-800 dark:text-green-200">
                                Khuyến nghị sản xuất
                              </span>
                            </div>
                            <div className="text-sm text-green-700 dark:text-green-300">
                              Bạn có thể sản xuất ngay {Math.min(calculateProductionCapacity(selectedProduct).canProduce, 10)} sản phẩm 
                              với chi phí {helperUtils.formatCurrency(getProductCost(selectedProduct) * Math.min(calculateProductionCapacity(selectedProduct).canProduce, 10))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                      <Button
                        onClick={() => router.push(`/products/edit?id=${selectedProduct.id}`)}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Chỉnh sửa sản phẩm
                      </Button>
                      <Button
                        onClick={() => router.push(`/sales/new?product=${selectedProduct.id}`)}
                        disabled={selectedProduct.currentStock === 0}
                        className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Bán hàng ngay
                      </Button>
                      <Button
                        onClick={() => router.push(`/products/new?product=${selectedProduct.id}`)}
                        disabled={calculateProductionCapacity(selectedProduct).canProduce === 0}
                        className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                      >
                        <Factory className="h-4 w-4 mr-2" />
                        Sản xuất thêm
                      </Button>
                    </div>
                  </CardContent>
                </div>
              </Card>
            </div>
          )}
        </div>
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
  );
}