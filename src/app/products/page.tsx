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
  Package, 
  Plus, 
  Search,
  Edit,
  Trash2,
  Factory,
  AlertTriangle,
  CheckCircle,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';

export default function ProductsPage() {
  const [user, loading, error] = useAuthState(auth);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
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
    // Filter products based on search term
    const filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProducts(filtered);
  }, [products, searchTerm]);

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

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${productName}"?`)) {
      return;
    }

    try {
      await productsUtils.delete(productId);
      toast.success(`Đã xóa sản phẩm: ${productName}`);
      await loadData(); // Reload data
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Có lỗi xảy ra khi xóa sản phẩm');
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
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Quản lý sản phẩm</h1>
            </div>
            <Button onClick={() => router.push('/products/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Tạo sản phẩm mới
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm kiếm sản phẩm..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" onClick={loadData}>
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
              className="h-20 flex-col space-y-2"
            >
              <Factory className="h-6 w-6" />
              <span>Đóng gói sản phẩm</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/sales/new')}
              className="h-20 flex-col space-y-2"
            >
              <Package className="h-6 w-6" />
              <span>Bán hàng</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/products/new')}
              className="h-20 flex-col space-y-2"
            >
              <Plus className="h-6 w-6" />
              <span>Thêm sản phẩm</span>
            </Button>
          </div>

          {/* Products List */}
          {filteredProducts.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {searchTerm ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm nào'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm 
                    ? 'Thử tìm kiếm với từ khóa khác' 
                    : 'Tạo sản phẩm đầu tiên để bắt đầu quản lý'
                  }
                </p>
                {!searchTerm && (
                  <Button onClick={() => router.push('/products/new')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tạo sản phẩm mới
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product) => {
                const capacity = calculateProductionCapacity(product);
                const cost = getProductCost(product);
                const profit = product.sellingPrice - cost;
                const profitMargin = product.sellingPrice > 0 ? (profit / product.sellingPrice) * 100 : 0;

                return (
                  <Card key={product.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{product.name}</CardTitle>
                          <div className="flex items-center space-x-2">
                            <Badge variant={product.currentStock > 0 ? "default" : "destructive"}>
                              Tồn: {product.currentStock}
                            </Badge>
                            <Badge variant="outline">
                              Có thể SX: {capacity.canProduce}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedProduct(product)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/products/${product.id}/edit`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteProduct(product.id!, product.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Pricing Info */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Chi phí</div>
                          <div className="font-medium text-orange-600">
                            {helperUtils.formatCurrency(cost)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Giá bán</div>
                          <div className="font-medium text-blue-600">
                            {helperUtils.formatCurrency(product.sellingPrice)}
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Profit Analysis */}
                      <div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Lợi nhuận</span>
                          <span className={`font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {helperUtils.formatCurrency(profit)} ({profitMargin.toFixed(1)}%)
                          </span>
                        </div>
                      </div>

                      {/* Production Capacity Alert */}
                      {capacity.canProduce === 0 && (
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            Không thể sản xuất do thiếu vật tư
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Formula Preview */}
                      <div>
                        <div className="text-xs text-muted-foreground mb-2">
                          Công thức ({product.formula.length} vật tư)
                        </div>
                        <div className="space-y-1">
                          {product.formula.slice(0, 2).map((ingredient, index) => (
                            <div key={index} className="text-xs flex justify-between">
                              <span>{ingredient.materialName}</span>
                              <span>{ingredient.quantity}</span>
                            </div>
                          ))}
                          {product.formula.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{product.formula.length - 2} vật tư khác
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex space-x-2 pt-2">
                        {/* <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/products/new?product=${product.id}`)}
                          disabled={capacity.canProduce === 0}
                          className="flex-1"
                        >
                          <Factory className="h-3 w-3 mr-1" />
                          Đóng gói
                        </Button> */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/sales/new?product=${product.id}`)}
                          disabled={product.currentStock === 0}
                          className="flex-1"
                        >
                          <Package className="h-3 w-3 mr-1" />
                          Bán
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Product Detail Modal */}
          {selectedProduct && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{selectedProduct.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedProduct(null)}
                    >
                      ×
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Tồn kho</div>
                      <div className="text-lg font-semibold">{selectedProduct.currentStock}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Giá bán</div>
                      <div className="text-lg font-semibold">
                        {helperUtils.formatCurrency(selectedProduct.sellingPrice)}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Formula Details */}
                  <div>
                    <h4 className="font-medium mb-3">Công thức sản xuất chi tiết</h4>
                    <div className="space-y-2">
                      {selectedProduct.formula.map((ingredient, index) => {
                        const material = materials.find(m => m.id === ingredient.materialId);
                        const itemCost = material ? material.unitPrice * ingredient.quantity : 0;

                        return (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                            <div>
                              <span className="font-medium">{ingredient.materialName}</span>
                              <div className="text-sm text-muted-foreground">
                                {ingredient.quantity} {material?.unit || ''} × {helperUtils.formatCurrency(material?.unitPrice || 0)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">{helperUtils.formatCurrency(itemCost)}</div>
                              <div className="text-sm text-muted-foreground">
                                Tồn: {material?.currentStock || 0}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Cost Analysis */}
                  <div>
                    <h4 className="font-medium mb-3">Phân tích chi phí</h4>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-3 border rounded">
                        <div className="text-lg font-bold text-orange-600">
                          {helperUtils.formatCurrency(getProductCost(selectedProduct))}
                        </div>
                        <div className="text-xs text-muted-foreground">Chi phí</div>
                      </div>
                      <div className="p-3 border rounded">
                        <div className="text-lg font-bold text-blue-600">
                          {helperUtils.formatCurrency(selectedProduct.sellingPrice)}
                        </div>
                        <div className="text-xs text-muted-foreground">Giá bán</div>
                      </div>
                      <div className="p-3 border rounded">
                        <div className={`text-lg font-bold ${(selectedProduct.sellingPrice - getProductCost(selectedProduct)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {helperUtils.formatCurrency(selectedProduct.sellingPrice - getProductCost(selectedProduct))}
                        </div>
                        <div className="text-xs text-muted-foreground">Lợi nhuận</div>
                      </div>
                    </div>
                  </div>

                  {/* Production Capacity */}
                  <div>
                    <h4 className="font-medium mb-3">Khả năng sản xuất</h4>
                    <div className="p-3 border rounded">
                      <div className="flex items-center justify-between">
                        <span>Có thể sản xuất tối đa:</span>
                        <Badge variant={calculateProductionCapacity(selectedProduct).canProduce > 0 ? "default" : "destructive"}>
                          {calculateProductionCapacity(selectedProduct).canProduce} sản phẩm
                        </Badge>
                      </div>
                      {calculateProductionCapacity(selectedProduct).missingMaterials.length > 0 && (
                        <div className="mt-2 text-sm text-red-600">
                          Thiếu vật tư: {calculateProductionCapacity(selectedProduct).missingMaterials.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}