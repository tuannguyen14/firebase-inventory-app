'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { 
  Material, 
  Product,
  materialsUtils, 
  productsUtils 
} from '@/lib/firebase-utils';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Package, 
  Plus, 
  Minus,
  AlertCircle,
  CheckCircle,
  Trash2,
  Sparkles,
  TrendingUp,
  Calculator,
  Box,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';

interface FormulaItem {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
}

interface ProductFormData {
  name: string;
  sellingPrice: number;
  initialStock: number;
  formula: FormulaItem[];
}

export default function NewProductPage() {
  const [user, loading, error] = useAuthState(auth);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    sellingPrice: 0,
    initialStock: 0,
    formula: []
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
    if (user) {
      loadMaterials();
    }
  }, [user]);

  const loadMaterials = async () => {
    try {
      setIsLoading(true);
      const materialsData = await materialsUtils.getAll();
      setMaterials(materialsData);
    } catch (error) {
      console.error('Error loading materials:', error);
      toast.error('Không thể tải danh sách vật tư');
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
    if (!selectedMaterial) {
      toast.error('Không tìm thấy vật tư');
      return;
    }

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

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên sản phẩm');
      return false;
    }

    if (formData.sellingPrice <= 0) {
      toast.error('Giá bán phải lớn hơn 0');
      return false;
    }

    if (formData.formula.length === 0) {
      toast.error('Vui lòng thêm ít nhất một vật tư vào công thức');
      return false;
    }

    if (formData.initialStock < 0) {
      toast.error('Tồn kho ban đầu không được âm');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setIsSubmitting(true);

      const productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
        name: formData.name.trim(),
        currentStock: formData.initialStock,
        formula: formData.formula.map(item => ({
          materialId: item.materialId,
          materialName: item.materialName,
          quantity: item.quantity
        })),
        sellingPrice: formData.sellingPrice
      };

      const productId = await productsUtils.create(productData);
      
      if (formData.initialStock > 0) {
        const materialsUsed = formData.formula.map(item => {
          const material = materials.find(m => m.id === item.materialId);
          return {
            materialId: item.materialId,
            materialName: item.materialName,
            quantityUsed: item.quantity * formData.initialStock,
            unitPrice: material?.unitPrice || 0
          };
        });

        const totalCost = materialsUsed.reduce((sum, item) => sum + (item.quantityUsed * item.unitPrice), 0);

        await addDoc(collection(db, 'production_logs'), {
          productId,
          productName: formData.name.trim(),
          quantityProduced: formData.initialStock,
          materialsUsed,
          totalCost,
          costPerUnit: totalCost / formData.initialStock,
          createdAt: Timestamp.now(),
          createdBy: user?.uid,
          note: 'Tồn kho ban đầu khi tạo sản phẩm'
        });
      }
      
      toast.success(`Đã tạo sản phẩm: ${formData.name}${formData.initialStock > 0 ? ` với ${formData.initialStock} sản phẩm có sẵn` : ''}`);
      router.push('/products');

    } catch (error) {
      console.error('Error creating product:', error);
      toast.error('Có lỗi xảy ra khi tạo sản phẩm');
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600"></div>
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400 opacity-20 blur-xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-gradient-to-r from-pink-400 to-orange-400 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse animation-delay-4000"></div>
      </div>

      {/* Header */}
      <div className="relative border-b bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 border-white/20 shadow-lg shadow-indigo-500/5">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center space-x-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="group hover:bg-white/50 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform duration-300" />
                Quay lại
              </Button>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl blur opacity-30 group-hover:opacity-40 transition-opacity duration-300"></div>
                  <div className="relative bg-gradient-to-r from-indigo-500 to-purple-500 p-2 rounded-xl">
                    <Package className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Tạo sản phẩm mới
                  </h1>
                  <p className="text-sm text-gray-500">Xây dựng công thức và phân tích lợi nhuận</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
              <span className="text-sm font-medium text-gray-600">Modern Design</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-6xl mx-auto space-y-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Product Info */}
            <Card className="group bg-white/70 backdrop-blur-xl border-white/20 shadow-xl shadow-indigo-500/5 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 hover:-translate-y-1">
              <CardHeader className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg">
                    <Box className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      Thông tin cơ bản
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      Nhập tên, giá bán và tồn kho ban đầu của sản phẩm
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3 group/input">
                    <Label htmlFor="product-name" className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                      <span>Tên sản phẩm</span>
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="product-name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        name: e.target.value
                      }))}
                      placeholder="Ví dụ: Nước mắm cao cấp 500ml"
                      className="bg-white/50 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20 transition-all duration-300 group-hover/input:bg-white/80"
                      required
                    />
                  </div>

                  <div className="space-y-3 group/input">
                    <Label htmlFor="selling-price" className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                      <span>Giá bán</span>
                      <span className="text-red-500">*</span>
                    </Label>
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
                      className="bg-white/50 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20 transition-all duration-300 group-hover/input:bg-white/80"
                      required
                    />
                  </div>

                  <div className="space-y-3 group/input">
                    <Label htmlFor="initial-stock" className="text-sm font-semibold text-gray-700">
                      Tồn kho ban đầu
                    </Label>
                    <Input
                      id="initial-stock"
                      type="number"
                      min="0"
                      step="1"
                      value={formData.initialStock || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        initialStock: parseInt(e.target.value) || 0
                      }))}
                      placeholder="Số lượng có sẵn"
                      className="bg-white/50 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20 transition-all duration-300 group-hover/input:bg-white/80"
                    />
                  </div>
                </div>

                <Alert className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 border-l-4 border-l-blue-500">
                  <AlertCircle className="h-4 w-4 text-blue-500" />
                  <AlertDescription className="text-blue-800">
                    <strong>Tồn kho ban đầu:</strong> Nếu bạn đã có sẵn sản phẩm này, nhập số lượng. 
                    Để 0 nếu muốn bắt đầu từ việc sản xuất mới.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Formula Builder */}
            <Card className="group bg-white/70 backdrop-blur-xl border-white/20 shadow-xl shadow-indigo-500/5 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 hover:-translate-y-1">
              <CardHeader className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                      Công thức sản xuất
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      Thêm các vật tư cần thiết để tạo ra 1 sản phẩm
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add Material Section */}
                <div className="bg-gradient-to-r from-gray-50/50 to-gray-100/50 backdrop-blur-sm border border-gray-200/50 rounded-xl p-6 hover:shadow-lg transition-all duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-gray-700">Chọn vật tư</Label>
                      <Select
                        value={selectedMaterialId}
                        onValueChange={setSelectedMaterialId}
                      >
                        <SelectTrigger className="bg-white/70 border-gray-200 focus:border-cyan-500 focus:ring-cyan-500/20 transition-all duration-300">
                          <SelectValue placeholder="Chọn vật tư..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white/95 backdrop-blur-xl border-gray-200/50">
                          {materials
                            .filter(material => !formData.formula.some(item => item.materialId === material.id))
                            .map((material) => (
                              <SelectItem key={material.id} value={material.id!} className="hover:bg-cyan-50/50">
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-medium">{material.name}</span>
                                  <div className="flex items-center space-x-2 ml-4">
                                    <Badge variant="secondary" className="bg-cyan-100 text-cyan-800">
                                      {material.currentStock} {material.unit}
                                    </Badge>
                                    <span className="text-xs text-gray-500 font-medium">
                                      {formatCurrency(material.unitPrice)}
                                    </span>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-gray-700">Số lượng</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={materialQuantity || ''}
                        onChange={(e) => setMaterialQuantity(parseFloat(e.target.value) || 0)}
                        placeholder="Số lượng"
                        className="bg-white/70 border-gray-200 focus:border-cyan-500 focus:ring-cyan-500/20 transition-all duration-300"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>&nbsp;</Label>
                      <Button
                        type="button"
                        onClick={addMaterialToFormula}
                        disabled={!selectedMaterialId || materialQuantity <= 0}
                        className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Thêm vào công thức
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Current Formula */}
                {formData.formula.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-semibold text-lg text-gray-800">Công thức hiện tại:</h4>
                      <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
                        {formData.formula.length} vật tư
                      </Badge>
                    </div>
                    <div className="grid gap-4">
                      {formData.formula.map((item, index) => {
                        const material = materials.find(m => m.id === item.materialId);
                        const itemCost = material ? material.unitPrice * item.quantity : 0;

                        return (
                          <div key={item.materialId} className="group/item bg-white/60 backdrop-blur-sm border border-gray-200/50 rounded-xl p-4 hover:shadow-lg hover:bg-white/80 transition-all duration-300 hover:-translate-y-0.5">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3">
                                  <span className="font-semibold text-gray-800">{item.materialName}</span>
                                  <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
                                    {item.unit}
                                  </Badge>
                                </div>
                                <div className="text-sm text-gray-600 mt-1 flex items-center space-x-1">
                                  <span>Chi phí:</span>
                                  <span className="font-semibold text-orange-600">{formatCurrency(itemCost)}</span>
                                </div>
                              </div>

                              <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2 bg-gray-50/50 rounded-lg p-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-red-100 hover:text-red-600 transition-colors duration-200"
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
                                    className="w-20 text-center border-0 bg-transparent font-semibold focus:ring-2 focus:ring-cyan-500/20"
                                  />

                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-green-100 hover:text-green-600 transition-colors duration-200"
                                    onClick={() => updateFormulaQuantity(item.materialId, item.quantity + 0.1)}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-red-100 hover:text-red-600 transition-colors duration-200 opacity-0 group-hover/item:opacity-100"
                                  onClick={() => removeMaterialFromFormula(item.materialId)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
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
              <Card className="group bg-white/70 backdrop-blur-xl border-white/20 shadow-xl shadow-indigo-500/5 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 hover:-translate-y-1">
                <CardHeader className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg">
                      <Calculator className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                        Phân tích chi phí & lợi nhuận
                      </CardTitle>
                      <CardDescription className="text-gray-600">
                        Ước tính dựa trên giá vật tư hiện tại
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="group/stat bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200/50 rounded-xl p-6 text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                      <div className="text-3xl font-bold text-orange-600 mb-2 group-hover/stat:scale-110 transition-transform duration-300">
                        {formatCurrency(estimatedCost)}
                      </div>
                      <div className="text-sm font-medium text-orange-700">Chi phí ước tính</div>
                      <div className="text-xs text-orange-600 mt-1">per sản phẩm</div>
                    </div>

                    <div className="group/stat bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/50 rounded-xl p-6 text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                      <div className="text-3xl font-bold text-blue-600 mb-2 group-hover/stat:scale-110 transition-transform duration-300">
                        {formatCurrency(formData.sellingPrice)}
                      </div>
                      <div className="text-sm font-medium text-blue-700">Giá bán</div>
                      <div className="text-xs text-blue-600 mt-1">per sản phẩm</div>
                    </div>

                    <div className={`group/stat border rounded-xl p-6 text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${
                      estimatedProfit >= 0 
                        ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200/50' 
                        : 'bg-gradient-to-br from-red-50 to-pink-50 border-red-200/50'
                    }`}>
                      <div className={`text-3xl font-bold mb-2 group-hover/stat:scale-110 transition-transform duration-300 ${
                        estimatedProfit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(estimatedProfit)}
                      </div>
                      <div className={`text-sm font-medium ${
                        estimatedProfit >= 0 ? 'text-green-700' : 'text-red-700'
                      }`}>
                        Lợi nhuận ({profitMargin.toFixed(1)}%)
                      </div>
                      <div className={`text-xs mt-1 flex items-center justify-center space-x-1 ${
                        estimatedProfit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        <TrendingUp className="h-3 w-3" />
                        <span>per sản phẩm</span>
                      </div>
                    </div>
                  </div>

                  {/* Profit Analysis Alerts */}
                  <div className="mt-6 space-y-4">
                    {estimatedProfit < 0 && (
                      <Alert className="bg-gradient-to-r from-red-50 to-pink-50 border-red-200 border-l-4 border-l-red-500 animate-pulse">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        <AlertDescription className="text-red-800">
                          <strong>⚠️ Cảnh báo:</strong> Giá bán thấp hơn chi phí sản xuất. Bạn sẽ bị lỗ{' '}
                          <span className="font-bold">{formatCurrency(Math.abs(estimatedProfit))}</span> mỗi sản phẩm.
                        </AlertDescription>
                      </Alert>
                    )}

                    {profitMargin > 0 && profitMargin < 20 && (
                      <Alert className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200 border-l-4 border-l-yellow-500">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-yellow-800">
                          <strong>💡 Lưu ý:</strong> Biên lợi nhuận thấp ({profitMargin.toFixed(1)}%). 
                          Cân nhắc tăng giá bán hoặc tối ưu chi phí để tăng lợi nhuận.
                        </AlertDescription>
                      </Alert>
                    )}

                    {profitMargin >= 20 && (
                      <Alert className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 border-l-4 border-l-green-500">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          <strong>🎉 Tuyệt vời!</strong> Biên lợi nhuận tốt ({profitMargin.toFixed(1)}%). 
                          Sản phẩm có tiềm năng kinh doanh cao.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Detailed Breakdown */}
                  {formData.formula.length > 0 && (
                    <div className="mt-6 p-4 bg-gradient-to-r from-gray-50/50 to-slate-50/50 rounded-xl border border-gray-200/50">
                      <h5 className="font-semibold text-gray-800 mb-3 flex items-center space-x-2">
                        <span>Chi tiết chi phí:</span>
                        <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                          {formData.formula.length} thành phần
                        </Badge>
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {formData.formula.map((item) => {
                          const material = materials.find(m => m.id === item.materialId);
                          const itemCost = material ? material.unitPrice * item.quantity : 0;
                          const costPercentage = estimatedCost > 0 ? (itemCost / estimatedCost) * 100 : 0;

                          return (
                            <div key={item.materialId} className="flex items-center justify-between p-3 bg-white/60 rounded-lg border border-gray-200/30">
                              <div className="flex-1">
                                <div className="font-medium text-gray-800">{item.materialName}</div>
                                <div className="text-sm text-gray-600">
                                  {item.quantity} {item.unit} × {formatCurrency(material?.unitPrice || 0)}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-orange-600">{formatCurrency(itemCost)}</div>
                                <div className="text-xs text-gray-500">{costPercentage.toFixed(1)}%</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Submit Button */}
            <Card className="group bg-white/70 backdrop-blur-xl border-white/20 shadow-xl shadow-indigo-500/5 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500">
              <CardContent className="p-8">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center space-x-2 text-gray-600 mb-4">
                    <span className="text-sm">Sẵn sàng tạo sản phẩm?</span>
                    <Sparkles className="h-4 w-4 text-indigo-500" />
                  </div>
                  
                  <Button
                    type="submit"
                    disabled={isSubmitting || !formData.name || formData.sellingPrice <= 0 || formData.formula.length === 0}
                    className="w-full h-14 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white font-semibold text-lg shadow-xl hover:shadow-2xl transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                    size="lg"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    <div className="relative flex items-center justify-center space-x-3">
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                          <span>Đang tạo sản phẩm...</span>
                        </>
                      ) : (
                        <>
                          <Package className="h-5 w-5" />
                          <span>Tạo sản phẩm mới</span>
                          <Sparkles className="h-4 w-4 animate-pulse" />
                        </>
                      )}
                    </div>
                  </Button>

                  {/* Form Summary */}
                  <div className="flex items-center justify-center space-x-6 text-sm text-gray-500 pt-4 border-t border-gray-200/50">
                    <div className="flex items-center space-x-1">
                      <CheckCircle className={`h-4 w-4 ${formData.name ? 'text-green-500' : 'text-gray-300'}`} />
                      <span>Tên sản phẩm</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <CheckCircle className={`h-4 w-4 ${formData.sellingPrice > 0 ? 'text-green-500' : 'text-gray-300'}`} />
                      <span>Giá bán</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <CheckCircle className={`h-4 w-4 ${formData.formula.length > 0 ? 'text-green-500' : 'text-gray-300'}`} />
                      <span>Công thức</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </form>

        </div>
      </main>

      {/* Custom CSS for animations */}
      <style jsx>{`
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}