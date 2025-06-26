'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { 
  Product, 
  Material,
  productsUtils, 
  materialsUtils 
} from '@/lib/firebase-utils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  Package, 
  Plus, 
  Minus,
  Trash2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface FormulaItem {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
}

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [product, setProduct] = useState<Product | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    sellingPrice: 0,
    formula: [] as FormulaItem[]
  });

  // States for adding new formula item
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [materialQuantity, setMaterialQuantity] = useState<number>(1);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && params.id) {
      loadData();
    }
  }, [user, params.id]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [productData, materialsData] = await Promise.all([
        productsUtils.getById(params.id as string),
        materialsUtils.getAll()
      ]);

      if (!productData) {
        toast.error('Không tìm thấy sản phẩm');
        router.push('/products');
        return;
      }

      setProduct(productData);
      setMaterials(materialsData);
      setFormData({
        name: productData.name,
        sellingPrice: productData.sellingPrice,
        formula: productData.formula.map(item => {
          const material = materialsData.find(m => m.id === item.materialId);
          return {
            materialId: item.materialId,
            materialName: item.materialName,
            quantity: item.quantity,
            unit: material?.unit || ''
          };
        })
      });
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Không thể tải dữ liệu');
    } finally {
      setIsLoading(false);
    }
  };

  const addMaterialToFormula = () => {
    if (!selectedMaterialId || materialQuantity <= 0) {
      toast.error('Vui lòng chọn vật tư và nhập số lượng hợp lệ');
      return;
    }

    if (formData.formula.some(item => item.materialId === selectedMaterialId)) {
      toast.error('Vật tư này đã có trong công thức');
      return;
    }

    const selectedMaterial = materials.find(m => m.id === selectedMaterialId);
    if (!selectedMaterial) return;

    const newFormulaItem: FormulaItem = {
      materialId: selectedMaterialId,
      materialName: selectedMaterial.name,
      quantity: materialQuantity,
      unit: selectedMaterial.unit
    };

    setFormData(prev => ({
      ...prev,
      formula: [...prev.formula, newFormulaItem]
    }));

    setSelectedMaterialId('');
    setMaterialQuantity(1);
  };

  const removeMaterialFromFormula = (materialId: string) => {
    setFormData(prev => ({
      ...prev,
      formula: prev.formula.filter(item => item.materialId !== materialId)
    }));
  };

  const updateFormulaQuantity = (materialId: string, newQuantity: number) => {
    if (newQuantity <= 0) return;

    setFormData(prev => ({
      ...prev,
      formula: prev.formula.map(item => 
        item.materialId === materialId 
          ? { ...item, quantity: newQuantity }
          : item
      )
    }));
  };

  const calculateEstimatedCost = () => {
    return formData.formula.reduce((total, item) => {
      const material = materials.find(m => m.id === item.materialId);
      return total + (material ? material.unitPrice * item.quantity : 0);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên sản phẩm');
      return;
    }

    if (formData.sellingPrice <= 0) {
      toast.error('Giá bán phải lớn hơn 0');
      return;
    }

    if (formData.formula.length === 0) {
      toast.error('Vui lòng thêm ít nhất một vật tư vào công thức');
      return;
    }

    try {
      setIsSubmitting(true);

      const updates: Partial<Product> = {
        name: formData.name.trim(),
        formula: formData.formula.map(item => ({
          materialId: item.materialId,
          materialName: item.materialName,
          quantity: item.quantity
        })),
        sellingPrice: formData.sellingPrice
      };

      await productsUtils.update(params.id as string, updates);
      
      toast.success(`Đã cập nhật sản phẩm: ${formData.name}`);
      router.push('/products');

    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Có lỗi xảy ra khi cập nhật sản phẩm');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const estimatedCost = calculateEstimatedCost();
  const estimatedProfit = formData.sellingPrice - estimatedCost;
  const profitMargin = formData.sellingPrice > 0 ? (estimatedProfit / formData.sellingPrice) * 100 : 0;

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !product) {
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
                <Package className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-semibold">Chỉnh sửa sản phẩm</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Product Info */}
            <Card>
              <CardHeader>
                <CardTitle>Thông tin cơ bản</CardTitle>
                <CardDescription>
                  Chỉnh sửa tên và giá bán của sản phẩm
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="product-name">Tên sản phẩm</Label>
                    <Input
                      id="product-name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        name: e.target.value
                      }))}
                      placeholder="Tên sản phẩm"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="selling-price">Giá bán</Label>
                    <Input
                      id="selling-price"
                      type="number"
                      min="0"
                      step="1000"
                      value={formData.sellingPrice || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        sellingPrice: parseFloat(e.target.value) || 0
                      }))}
                      placeholder="Giá bán lẻ"
                      required
                    />
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Tồn kho hiện tại: <strong>{product.currentStock}</strong> sản phẩm
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Formula Editor - Similar to new product page */}
            <Card>
              <CardHeader>
                <CardTitle>Chỉnh sửa công thức</CardTitle>
                <CardDescription>
                  Cập nhật vật tư cần thiết để tạo ra 1 sản phẩm
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add Material Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
                  <div className="space-y-2">
                    <Label>Thêm vật tư</Label>
                    <Select
                      value={selectedMaterialId}
                      onValueChange={setSelectedMaterialId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn vật tư..." />
                      </SelectTrigger>
                      <SelectContent>
                        {materials
                          .filter(material => !formData.formula.some(item => item.materialId === material.id))
                          .map((material) => (
                            <SelectItem key={material.id} value={material.id!}>
                              {material.name} ({material.currentStock} {material.unit})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Số lượng</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={materialQuantity || ''}
                      onChange={(e) => setMaterialQuantity(parseFloat(e.target.value) || 0)}
                      placeholder="Số lượng"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>&nbsp;</Label>
                    <Button
                      type="button"
                      onClick={addMaterialToFormula}
                      disabled={!selectedMaterialId || materialQuantity <= 0}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Thêm
                    </Button>
                  </div>
                </div>

                {/* Current Formula */}
                {formData.formula.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Công thức hiện tại:</h4>
                    <div className="space-y-2">
                      {formData.formula.map((item) => {
                        const material = materials.find(m => m.id === item.materialId);
                        const itemCost = material ? material.unitPrice * item.quantity : 0;

                        return (
                          <div key={item.materialId} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium">{item.materialName}</span>
                                <Badge variant="outline">{item.unit}</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                Chi phí: {formatCurrency(itemCost)}
                              </div>
                            </div>

                            <div className="flex items-center space-x-3">
                              <div className="flex items-center space-x-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateFormulaQuantity(item.materialId, item.quantity - 0.1)}
                                  disabled={item.quantity <= 0.1}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>

                                <Input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={item.quantity}
                                  onChange={(e) => updateFormulaQuantity(item.materialId, parseFloat(e.target.value) || 0)}
                                  className="w-20 text-center"
                                />

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateFormulaQuantity(item.materialId, item.quantity + 0.1)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>

                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => removeMaterialFromFormula(item.materialId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cost Analysis */}
            {formData.formula.length > 0 && formData.sellingPrice > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Phân tích chi phí & lợi nhuận</CardTitle>
                  <CardDescription>
                    Ước tính dựa trên giá vật tư hiện tại
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {formatCurrency(estimatedCost)}
                      </div>
                      <div className="text-sm text-muted-foreground">Chi phí ước tính</div>
                    </div>

                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(formData.sellingPrice)}
                      </div>
                      <div className="text-sm text-muted-foreground">Giá bán</div>
                    </div>

                    <div className="text-center p-4 border rounded-lg">
                      <div className={`text-2xl font-bold ${estimatedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(estimatedProfit)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Lợi nhuận ({profitMargin.toFixed(1)}%)
                      </div>
                    </div>
                  </div>

                  {estimatedProfit < 0 && (
                    <Alert className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Cảnh báo: Giá bán thấp hơn chi phí sản xuất. Bạn sẽ bị lỗ {formatCurrency(Math.abs(estimatedProfit))} mỗi sản phẩm.
                      </AlertDescription>
                    </Alert>
                  )}

                  {profitMargin > 0 && profitMargin < 20 && (
                    <Alert className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Biên lợi nhuận thấp ({profitMargin.toFixed(1)}%). Cân nhắc tăng giá bán hoặc tối ưu chi phí.
                      </AlertDescription>
                    </Alert>
                  )}

                  {profitMargin >= 20 && (
                    <Alert className="mt-4">
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Biên lợi nhuận tốt ({profitMargin.toFixed(1)}%). Sản phẩm có tiềm năng kinh doanh.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Submit Buttons */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    className="flex-1"
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !formData.name || formData.sellingPrice <= 0 || formData.formula.length === 0}
                    className="flex-1"
                  >
                    {isSubmitting ? 'Đang cập nhật...' : 'Cập nhật sản phẩm'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      </main>
    </div>
  );
}