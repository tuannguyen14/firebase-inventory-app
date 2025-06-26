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

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  ShoppingCart, 
  Plus, 
  Minus,
  AlertTriangle,
  CheckCircle,
  User,
  Phone,
  Calculator
} from 'lucide-react';
import { toast } from 'sonner';

interface SaleFormData {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  customerName: string;
  customerPhone: string;
  note: string;
}

export default function NewSalePage() {
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
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Quay lại
              </Button>
              <div className="flex items-center space-x-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-semibold">Ghi nhận bán hàng</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* No Products Alert */}
          {products.length === 0 && (
            <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                Không có sản phẩm nào có tồn kho để bán. Vui lòng sản xuất thêm sản phẩm trước khi ghi nhận bán hàng.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Product Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Thông tin sản phẩm</CardTitle>
                <CardDescription>
                  Chọn sản phẩm và số lượng bán
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="product">Sản phẩm</Label>
                    <Select
                      value={formData.productId}
                      onValueChange={(value) => handleProductSelect(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn sản phẩm..." />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id!}>
                            <div className="flex items-center justify-between w-full">
                              <span>{product.name}</span>
                              <div className="flex items-center space-x-2 ml-4">
                                <Badge variant="secondary">
                                  Tồn: {product.currentStock}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {helperUtils.formatCurrency(product.sellingPrice)}
                                </span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unit-price">Giá bán</Label>
                    <Input
                      id="unit-price"
                      type="number"
                      min="0"
                      step="1000"
                      value={formData.unitPrice || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        unitPrice: parseFloat(e.target.value) || 0
                      }))}
                      placeholder="Giá bán"
                    />
                  </div>
                </div>

                {selectedProduct && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <div>Tồn kho hiện tại: <strong>{selectedProduct.currentStock} sản phẩm</strong></div>
                        <div>Giá niêm yết: <strong>{helperUtils.formatCurrency(selectedProduct.sellingPrice)}</strong></div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="quantity">Số lượng bán</Label>
                  <div className="flex items-center space-x-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleQuantityChange(formData.quantity - 1)}
                      disabled={formData.quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>

                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      max={selectedProduct?.currentStock || 999}
                      value={formData.quantity || ''}
                      onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                      className="text-center w-24"
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleQuantityChange(formData.quantity + 1)}
                      disabled={!selectedProduct || formData.quantity >= selectedProduct.currentStock}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>

                    {selectedProduct && (
                      <span className="text-sm text-muted-foreground">
                        Tối đa: {selectedProduct.currentStock}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle>Thông tin khách hàng (tùy chọn)</CardTitle>
                <CardDescription>
                  Ghi nhận thông tin khách hàng nếu cần
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer-name">
                      <User className="h-4 w-4 inline mr-2" />
                      Tên khách hàng
                    </Label>
                    <Input
                      id="customer-name"
                      value={formData.customerName}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        customerName: e.target.value
                      }))}
                      placeholder="Tên khách hàng"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customer-phone">
                      <Phone className="h-4 w-4 inline mr-2" />
                      Số điện thoại
                    </Label>
                    <Input
                      id="customer-phone"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        customerPhone: e.target.value
                      }))}
                      placeholder="Số điện thoại"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="note">Ghi chú</Label>
                  <Textarea
                    id="note"
                    value={formData.note}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      note: e.target.value
                    }))}
                    placeholder="Ghi chú về đơn hàng..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Order Summary */}
            {formData.productId && formData.quantity > 0 && formData.unitPrice > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calculator className="h-5 w-5 mr-2" />
                    Tóm tắt đơn hàng
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Sản phẩm:</span>
                      <span className="font-medium">{formData.productName}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Số lượng:</span>
                      <span className="font-medium">{formData.quantity}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Giá bán:</span>
                      <span className="font-medium">{helperUtils.formatCurrency(formData.unitPrice)}</span>
                    </div>

                    <Separator />

                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium">Tổng tiền:</span>
                      <span className="text-lg font-bold text-green-600">
                        {helperUtils.formatCurrency(totals.totalRevenue)}
                      </span>
                    </div>

                    {selectedProduct && (
                      <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span>Tồn kho sau bán:</span>
                        <span>{selectedProduct.currentStock - formData.quantity} sản phẩm</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Submit Button */}
            <Card>
              <CardContent className="pt-6">
                <Button
                  type="submit"
                  disabled={
                    isSubmitting || 
                    !formData.productId || 
                    formData.quantity <= 0 || 
                    formData.unitPrice <= 0 ||
                    products.length === 0
                  }
                  className="w-full"
                  size="lg"
                >
                  {isSubmitting ? (
                    'Đang xử lý...'
                  ) : (
                    `Ghi nhận bán hàng - ${helperUtils.formatCurrency(totals.totalRevenue)}`
                  )}
                </Button>
              </CardContent>
            </Card>
          </form>
        </div>
      </main>
    </div>
  );
}