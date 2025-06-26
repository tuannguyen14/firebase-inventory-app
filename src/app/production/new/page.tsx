'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { 
  Product, 
  Material, 
  productsUtils, 
  materialsUtils, 
  productionUtils,
  helperUtils 
} from '@/lib/firebase-utils';

export default function NewProductionPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors: string[];
    canProduce?: number;
  } | null>(null);

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsData, materialsData] = await Promise.all([
          productsUtils.getAll(),
          materialsUtils.getAll()
        ]);
        setProducts(productsData);
        setMaterials(materialsData);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, []);

  // Validate production capacity when product or quantity changes
  useEffect(() => {
    if (selectedProductId && quantity > 0) {
      validateProduction();
    } else {
      setValidationResult(null);
    }
  }, [selectedProductId, quantity]);

  const validateProduction = async () => {
    if (!selectedProductId) return;

    const selectedProduct = products.find(p => p.id === selectedProductId);
    if (!selectedProduct) return;

    try {
      // Check production capacity
      const capacity = await productsUtils.checkProductionCapacity(selectedProductId);
      
      // Validate stock using helper function
      const validation = helperUtils.validateMaterialStock(
        materials,
        selectedProduct.formula,
        quantity
      );

      setValidationResult({
        ...validation,
        canProduce: capacity.canProduce
      });
    } catch (error) {
      console.error('Error validating production:', error);
      setValidationResult({
        isValid: false,
        errors: ['Có lỗi khi kiểm tra khả năng sản xuất']
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProductId || quantity <= 0) {
      alert('Vui lòng chọn sản phẩm và nhập số lượng hợp lệ');
      return;
    }

    if (!validationResult?.isValid) {
      alert('Không thể sản xuất do thiếu vật tư');
      return;
    }

    setLoading(true);

    try {
      await productionUtils.produceProduct(selectedProductId, quantity);
      
      alert('Đóng gói sản phẩm thành công!');
      router.push('/production');
    } catch (error: any) {
      console.error('Error producing product:', error);
      alert(error.message || 'Có lỗi xảy ra khi đóng gói sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Đóng gói sản phẩm mới
          </h1>
          <p className="text-muted-foreground">
            Tạo đơn đóng gói sản phẩm từ vật tư có sẵn
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Thông tin đóng gói</CardTitle>
            <CardDescription>
              Chọn sản phẩm và số lượng cần đóng gói
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Product Selection */}
              <div className="space-y-2">
                <Label htmlFor="product">Sản phẩm</Label>
                <Select
                  value={selectedProductId}
                  onValueChange={setSelectedProductId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn sản phẩm..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id!}>
                        <div className="flex items-center justify-between w-full">
                          <span>{product.name}</span>
                          <Badge variant="secondary" className="ml-2">
                            Tồn: {product.currentStock}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity Input */}
              <div className="space-y-2">
                <Label htmlFor="quantity">Số lượng đóng gói</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  placeholder="Nhập số lượng..."
                />
                {validationResult?.canProduce !== undefined && (
                  <p className="text-sm text-muted-foreground">
                    Có thể sản xuất tối đa: {validationResult.canProduce} sản phẩm
                  </p>
                )}
              </div>

              {/* Validation Alert */}
              {validationResult && (
                <Alert variant={validationResult.isValid ? "default" : "destructive"}>
                  {validationResult.isValid ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    {validationResult.isValid ? (
                      "Có đủ vật tư để sản xuất"
                    ) : (
                      <div>
                        <p className="font-medium mb-2">Không đủ vật tư:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {validationResult.errors.map((error, index) => (
                            <li key={index} className="text-sm">{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !validationResult?.isValid}
              >
                {loading ? 'Đang xử lý...' : 'Tạo đơn đóng gói'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Product Details */}
        {selectedProduct && (
          <Card>
            <CardHeader>
              <CardTitle>Chi tiết sản phẩm</CardTitle>
              <CardDescription>
                Công thức và vật tư cần thiết
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Product Info */}
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{selectedProduct.name}</h3>
                <Badge variant="outline">
                  Tồn kho: {selectedProduct.currentStock}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Giá bán</span>
                <span className="font-medium">
                  {helperUtils.formatCurrency(selectedProduct.sellingPrice)}
                </span>
              </div>

              <Separator />

              {/* Formula */}
              <div>
                <h4 className="font-medium mb-3">Công thức sản xuất (1 sản phẩm)</h4>
                <div className="space-y-2">
                  {selectedProduct.formula.map((ingredient, index) => {
                    const material = materials.find(m => m.id === ingredient.materialId);
                    const requiredTotal = ingredient.quantity * quantity;
                    const isEnough = material ? material.currentStock >= requiredTotal : false;

                    return (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div>
                          <span className="font-medium">{ingredient.materialName}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            {ingredient.quantity} {material?.unit}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              Cần: {requiredTotal}
                            </span>
                            <Badge variant={isEnough ? "default" : "destructive"}>
                              Có: {material?.currentStock || 0}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Production Summary */}
              {quantity > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-3">Tóm tắt đóng gói</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Số lượng sản xuất:</span>
                        <span className="font-medium">{quantity} sản phẩm</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tồn kho sau sản xuất:</span>
                        <span className="font-medium">
                          {selectedProduct.currentStock + quantity} sản phẩm
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}