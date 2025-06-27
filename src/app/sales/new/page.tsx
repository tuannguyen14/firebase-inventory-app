'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Product, 
  productsUtils, 
  salesUtils,
  helperUtils 
} from '@/lib/firebase-utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  ShoppingCart, 
  Plus, 
  Minus,
  AlertTriangle,
  CheckCircle,
  User,
  Phone,
  Calculator,
  Package,
  DollarSign,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { Suspense } from 'react';

interface SaleFormData {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  customerName: string;
  customerPhone: string;
  note: string;
}

 function NewSalePageContent() {
  const [user, loading] = useAuthState(auth);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [formData, setFormData] = useState<SaleFormData>({
    productId: '',
    productName: '',
    quantity: 1,
    unitPrice: 0,
    customerName: '',
    customerPhone: '',
    note: ''
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadProducts();
    }
  }, [user]);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const productsData = await productsUtils.getAll();
      // Chỉ hiển thị sản phẩm có tồn kho > 0
      const availableProducts = productsData.filter(product => product.currentStock > 0);
      setProducts(availableProducts);

      // Set initial product from query parameter
      const productParam = searchParams.get('product');
      if (productParam && availableProducts.some(p => p.id === productParam)) {
        handleProductSelect(productParam, availableProducts);
      }
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Không thể tải danh sách sản phẩm');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProductSelect = (productId: string, productsList = products) => {
    const selectedProduct = productsList.find(p => p.id === productId);
    if (selectedProduct) {
      setFormData(prev => ({
        ...prev,
        productId: productId,
        productName: selectedProduct.name,
        unitPrice: selectedProduct.sellingPrice,
        quantity: Math.min(prev.quantity || 1, selectedProduct.currentStock)
      }));
    }
  };

  const handleQuantityChange = (newQuantity: number) => {
    const selectedProduct = products.find(p => p.id === formData.productId);
    if (selectedProduct) {
      const maxQuantity = selectedProduct.currentStock;
      const validQuantity = Math.max(1, Math.min(newQuantity, maxQuantity));
      setFormData(prev => ({
        ...prev,
        quantity: validQuantity
      }));
    }
  };

  const calculateTotals = () => {
    const subtotal = formData.quantity * formData.unitPrice;
    return {
      subtotal,
      totalRevenue: subtotal
    };
  };

  const validateForm = () => {
    if (!formData.productId) {
      toast.error('Vui lòng chọn sản phẩm');
      return false;
    }

    if (formData.quantity <= 0) {
      toast.error('Số lượng phải lớn hơn 0');
      return false;
    }

    if (formData.unitPrice <= 0) {
      toast.error('Giá bán phải lớn hơn 0');
      return false;
    }

    const selectedProduct = products.find(p => p.id === formData.productId);
    if (selectedProduct && formData.quantity > selectedProduct.currentStock) {
      toast.error(`Không đủ tồn kho. Chỉ còn ${selectedProduct.currentStock} sản phẩm`);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setIsSubmitting(true);

      await salesUtils.sellProduct(
        formData.productId,
        formData.quantity,
        formData.unitPrice,
        formData.customerName || undefined,
        formData.customerPhone || undefined,
        formData.note || undefined,
        user?.uid
      );

      const totalRevenue = formData.quantity * formData.unitPrice;
      toast.success(
        `Đã ghi nhận bán hàng: ${formData.quantity} ${formData.productName} - ${helperUtils.formatCurrency(totalRevenue)}`
      );

      // Reset form
      setFormData({
        productId: '',
        productName: '',
        quantity: 1,
        unitPrice: 0,
        customerName: '',
        customerPhone: '',
        note: ''
      });

      // Reload products to update stock
      await loadProducts();

      // Optionally redirect to sales history
      // router.push('/sales');

    } catch (error: any) {
      console.error('Error recording sale:', error);
      toast.error(error.message || 'Có lỗi xảy ra khi ghi nhận bán hàng');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProduct = products.find(p => p.id === formData.productId);
  const totals = calculateTotals();

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-transparent bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
            <div className="absolute inset-2 bg-white dark:bg-gray-800 rounded-full"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 animate-pulse">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Modern Header with Glassmorphism */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-white/20 shadow-lg">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center space-x-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="hover:bg-white/50 dark:hover:bg-gray-800/50 transition-all duration-300 rounded-xl"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Quay lại
              </Button>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur opacity-20"></div>
                  <div className="relative bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-xl">
                    <ShoppingCart className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Ghi nhận bán hàng
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tạo đơn hàng mới</p>
                </div>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="hidden md:flex items-center space-x-4">
              <div className="text-center px-4 py-2 bg-white/60 dark:bg-gray-800/60 rounded-xl backdrop-blur-sm">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{products.length}</div>
                <div className="text-xs text-gray-500">Sản phẩm</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* No Products Alert */}
          {products.length === 0 && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-400/10 to-orange-400/10 border border-yellow-200/50 dark:border-yellow-800/50 p-6">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/5 to-orange-400/5"></div>
              <div className="relative flex items-start space-x-4">
                <div className="bg-yellow-500/20 p-3 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                    Không có sản phẩm
                  </h3>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    Không có sản phẩm nào có tồn kho để bán. Vui lòng sản xuất thêm sản phẩm trước khi ghi nhận bán hàng.
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Product & Customer Info */}
              <div className="lg:col-span-2 space-y-8">
                {/* Modern Product Selection Card */}
                <div className="group relative overflow-hidden rounded-3xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border border-white/20 dark:border-gray-700/20 shadow-xl hover:shadow-2xl transition-all duration-500">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5"></div>
                  <div className="relative p-8">
                    <div className="flex items-center space-x-3 mb-6">
                      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-2xl">
                        <Package className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Chọn sản phẩm</h2>
                        <p className="text-gray-500 dark:text-gray-400">Sản phẩm và số lượng bán</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {/* Product Selector */}
                      <div className="space-y-3">
                        <Label className="text-base font-medium text-gray-700 dark:text-gray-300">Sản phẩm</Label>
                        <Select
                          value={formData.productId}
                          onValueChange={(value) => handleProductSelect(value)}
                        >
                          <SelectTrigger className="h-14 rounded-2xl border-2 border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300">
                            <SelectValue placeholder="Chọn sản phẩm bán..." className="text-base" />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl">
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id!} className="rounded-xl my-1">
                                <div className="flex items-center justify-between w-full py-2">
                                  <span className="font-medium">{product.name}</span>
                                  <div className="flex items-center space-x-3 ml-4">
                                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                      Tồn: {product.currentStock}
                                    </Badge>
                                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                                      {helperUtils.formatCurrency(product.sellingPrice)}
                                    </span>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Selected Product Info */}
                      {selectedProduct && (
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200/50 dark:border-green-800/50 p-6 animate-in slide-in-from-top-2 duration-500">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400/10 to-emerald-400/10 rounded-full -translate-y-16 translate-x-16"></div>
                          <div className="relative flex items-start space-x-4">
                            <div className="bg-green-500/20 p-3 rounded-xl">
                              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="space-y-2">
                              <h4 className="font-semibold text-green-800 dark:text-green-200">Thông tin sản phẩm</h4>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-green-600 dark:text-green-400">Tồn kho:</span>
                                  <span className="font-bold text-green-800 dark:text-green-200 ml-2">
                                    {selectedProduct.currentStock} sản phẩm
                                  </span>
                                </div>
                                <div>
                                  <span className="text-green-600 dark:text-green-400">Giá niêm yết:</span>
                                  <span className="font-bold text-green-800 dark:text-green-200 ml-2">
                                    {helperUtils.formatCurrency(selectedProduct.sellingPrice)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Quantity Selector */}
                        <div className="space-y-3">
                          <Label className="text-base font-medium text-gray-700 dark:text-gray-300">Số lượng</Label>
                          <div className="flex items-center space-x-4">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleQuantityChange(formData.quantity - 1)}
                              disabled={formData.quantity <= 1}
                              className="h-12 w-12 rounded-2xl border-2 hover:scale-110 transition-all duration-300"
                            >
                              <Minus className="h-5 w-5" />
                            </Button>

                            <Input
                              type="number"
                              min="1"
                              max={selectedProduct?.currentStock || 999}
                              value={formData.quantity || ''}
                              onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                              className="text-center text-xl font-bold h-12 w-24 rounded-2xl border-2 bg-white/50 dark:bg-gray-800/50"
                            />

                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleQuantityChange(formData.quantity + 1)}
                              disabled={!selectedProduct || formData.quantity >= selectedProduct.currentStock}
                              className="h-12 w-12 rounded-2xl border-2 hover:scale-110 transition-all duration-300"
                            >
                              <Plus className="h-5 w-5" />
                            </Button>
                          </div>
                          {selectedProduct && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Tối đa: {selectedProduct.currentStock} sản phẩm
                            </p>
                          )}
                        </div>

                        {/* Unit Price */}
                        <div className="space-y-3">
                          <Label className="text-base font-medium text-gray-700 dark:text-gray-300">Giá bán</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <Input
                              type="number"
                              min="0"
                              step="1000"
                              value={formData.unitPrice || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                unitPrice: parseFloat(e.target.value) || 0
                              }))}
                              placeholder="Giá bán"
                              className="h-12 pl-12 rounded-2xl border-2 bg-white/50 dark:bg-gray-800/50 text-base font-medium"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modern Customer Info Card */}
                <div className="group relative overflow-hidden rounded-3xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border border-white/20 dark:border-gray-700/20 shadow-xl hover:shadow-2xl transition-all duration-500">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5"></div>
                  <div className="relative p-8">
                    <div className="flex items-center space-x-3 mb-6">
                      <div className="bg-gradient-to-r from-purple-500 to-pink-600 p-3 rounded-2xl">
                        <User className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Thông tin khách hàng</h2>
                        <p className="text-gray-500 dark:text-gray-400">Tùy chọn - để trống nếu không cần</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label className="text-base font-medium text-gray-700 dark:text-gray-300">Tên khách hàng</Label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <Input
                              value={formData.customerName}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                customerName: e.target.value
                              }))}
                              placeholder="Nhập tên khách hàng"
                              className="h-12 pl-12 rounded-2xl border-2 bg-white/50 dark:bg-gray-800/50"
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <Label className="text-base font-medium text-gray-700 dark:text-gray-300">Số điện thoại</Label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <Input
                              value={formData.customerPhone}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                customerPhone: e.target.value
                              }))}
                              placeholder="Nhập số điện thoại"
                              className="h-12 pl-12 rounded-2xl border-2 bg-white/50 dark:bg-gray-800/50"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-base font-medium text-gray-700 dark:text-gray-300">Ghi chú</Label>
                        <Textarea
                          value={formData.note}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            note: e.target.value
                          }))}
                          placeholder="Ghi chú về đơn hàng..."
                          rows={4}
                          className="rounded-2xl border-2 bg-white/50 dark:bg-gray-800/50 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Order Summary */}
              <div className="lg:col-span-1">
                <div className="sticky top-32">
                  {formData.productId && formData.quantity > 0 && formData.unitPrice > 0 && (
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 backdrop-blur-xl border border-green-200/50 dark:border-green-800/50 shadow-2xl">
                      <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10"></div>
                      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-green-400/20 to-emerald-400/20 rounded-full -translate-y-20 translate-x-20"></div>
                      
                      <div className="relative p-8">
                        <div className="flex items-center space-x-3 mb-8">
                          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-3 rounded-2xl">
                            <Calculator className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold text-green-800 dark:text-green-200">Tóm tắt đơn hàng</h2>
                            <div className="flex items-center space-x-2">
                              <Sparkles className="h-4 w-4 text-green-600" />
                              <p className="text-green-600 dark:text-green-400 text-sm">Sẵn sàng thanh toán</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-4">
                            <div className="flex justify-between items-center p-4 bg-white/50 dark:bg-gray-800/50 rounded-2xl">
                              <span className="text-gray-600 dark:text-gray-400">Sản phẩm:</span>
                              <span className="font-semibold text-gray-900 dark:text-white">{formData.productName}</span>
                            </div>

                            <div className="flex justify-between items-center p-4 bg-white/50 dark:bg-gray-800/50 rounded-2xl">
                              <span className="text-gray-600 dark:text-gray-400">Số lượng:</span>
                              <span className="font-semibold text-gray-900 dark:text-white">{formData.quantity}</span>
                            </div>

                            <div className="flex justify-between items-center p-4 bg-white/50 dark:bg-gray-800/50 rounded-2xl">
                              <span className="text-gray-600 dark:text-gray-400">Giá bán:</span>
                              <span className="font-semibold text-gray-900 dark:text-white">{helperUtils.formatCurrency(formData.unitPrice)}</span>
                            </div>
                          </div>

                          <Separator className="my-6" />

                          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white">
                            <div className="absolute inset-0 bg-white/10"></div>
                            <div className="relative flex justify-between items-center">
                              <div className="flex items-center space-x-2">
                                <TrendingUp className="h-6 w-6" />
                                <span className="text-xl font-bold">Tổng tiền:</span>
                              </div>
                              <span className="text-3xl font-bold">
                                {helperUtils.formatCurrency(totals.totalRevenue)}
                              </span>
                            </div>
                          </div>

                          {selectedProduct && (
                            <div className="flex justify-between items-center text-sm p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-2xl">
                              <span className="text-blue-600 dark:text-blue-400">Tồn kho sau bán:</span>
                              <span className="font-semibold text-blue-800 dark:text-blue-300">
                                {selectedProduct.currentStock - formData.quantity} sản phẩm
                              </span>
                            </div>
                          )}

                          {/* Submit Button */}
                          <Button
                            type="submit"
                            disabled={
                              isSubmitting || 
                              !formData.productId || 
                              formData.quantity <= 0 || 
                              formData.unitPrice <= 0 ||
                              products.length === 0
                            }
                            className="w-full h-16 text-lg font-bold rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-2xl hover:shadow-green-500/25 transform hover:scale-105 transition-all duration-300 disabled:transform-none disabled:hover:scale-100"
                          >
                            {isSubmitting ? (
                              <div className="flex items-center space-x-2">
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                <span>Đang xử lý...</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="h-6 w-6" />
                                <span>Ghi nhận bán hàng - {helperUtils.formatCurrency(totals.totalRevenue)}</span>
                              </div>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function NewSalePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Đang tải trang bán hàng...</div>}>
      <NewSalePageContent />
    </Suspense>
  );
}

export default NewSalePage;