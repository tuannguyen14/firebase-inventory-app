'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { materialsUtils, materialTransactionsUtils } from '@/lib/firebase-utils';
import type { Material } from '@/lib/firebase-utils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
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
  ArrowLeft, 
  Package, 
  Plus, 
  AlertCircle,
  CheckCircle,
  ShoppingCart,
  Trash2,
  Search,
  Filter,
  TrendingUp,
  Sparkles,
  Package2,
  DollarSign,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

interface ImportFormData {
  materialId: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
  note: string;
}

interface NewMaterialFormData {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  note: string;
}

export default function MaterialsImportPage() {
  const [user, loading] = useAuthState(auth);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'normal'>('all');
  const [importMode, setImportMode] = useState<'existing' | 'new'>('existing');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  // Form data for importing existing materials
  const [importForm, setImportForm] = useState<ImportFormData>({
    materialId: '',
    materialName: '',
    quantity: 0,
    unitPrice: 0,
    note: ''
  });

  // Form data for creating new materials
  const [newMaterialForm, setNewMaterialForm] = useState<NewMaterialFormData>({
    name: '',
    unit: '',
    quantity: 0,
    unitPrice: 0,
    note: ''
  });

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

  useEffect(() => {
    filterMaterials();
  }, [materials, searchTerm, stockFilter]);

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

  const filterMaterials = () => {
    let filtered = materials;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(material =>
        material.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by stock level
    if (stockFilter === 'low') {
      filtered = filtered.filter(material => material.currentStock < 10);
    } else if (stockFilter === 'normal') {
      filtered = filtered.filter(material => material.currentStock >= 10);
    }

    setFilteredMaterials(filtered);
  };

  const handleMaterialSelect = (materialId: string) => {
    const selectedMaterial = materials.find(m => m.id === materialId);
    if (selectedMaterial) {
      setImportForm(prev => ({
        ...prev,
        materialId: materialId,
        materialName: selectedMaterial.name,
        unitPrice: selectedMaterial.unitPrice
      }));
    }
  };

  const handleDeleteMaterial = async (materialId: string, materialName: string) => {
    try {
      setIsDeleting(true);
      await materialsUtils.delete(materialId);
      toast.success(`Đã xóa vật tư: ${materialName}`);
      await loadMaterials();
    } catch (error) {
      console.error('Error deleting material:', error);
      toast.error('Có lỗi xảy ra khi xóa vật tư');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImportExisting = async () => {
    if (!importForm.materialId || !importForm.quantity || !importForm.unitPrice) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (importForm.quantity <= 0) {
      toast.error('Số lượng phải lớn hơn 0');
      return;
    }

    if (importForm.unitPrice <= 0) {
      toast.error('Đơn giá phải lớn hơn 0');
      return;
    }

    try {
      setIsSubmitting(true);
      
      await materialTransactionsUtils.importMaterial(
        importForm.materialId,
        importForm.quantity,
        importForm.unitPrice,
        importForm.note || undefined,
        user?.uid
      );

      toast.success(`Đã nhập ${importForm.quantity} ${importForm.materialName}`);
      
      // Reset form
      setImportForm({
        materialId: '',
        materialName: '',
        quantity: 0,
        unitPrice: 0,
        note: ''
      });

      // Reload materials to update stock
      await loadMaterials();

    } catch (error) {
      console.error('Error importing material:', error);
      toast.error('Có lỗi xảy ra khi nhập vật tư');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNewMaterial = async () => {
    if (!newMaterialForm.name || !newMaterialForm.unit || !newMaterialForm.quantity || !newMaterialForm.unitPrice) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (newMaterialForm.quantity <= 0) {
      toast.error('Số lượng phải lớn hơn 0');
      return;
    }

    if (newMaterialForm.unitPrice <= 0) {
      toast.error('Đơn giá phải lớn hơn 0');
      return;
    }

    try {
      setIsSubmitting(true);

      // Create new material
      const materialId = await materialsUtils.create({
        name: newMaterialForm.name,
        unit: newMaterialForm.unit,
        currentStock: newMaterialForm.quantity,
        unitPrice: newMaterialForm.unitPrice
      });

      // Create import transaction
      await materialTransactionsUtils.importMaterial(
        materialId,
        newMaterialForm.quantity,
        newMaterialForm.unitPrice,
        newMaterialForm.note || `Tạo vật tư mới: ${newMaterialForm.name}`,
        user?.uid
      );

      toast.success(`Đã tạo vật tư mới: ${newMaterialForm.name}`);

      // Reset form
      setNewMaterialForm({
        name: '',
        unit: '',
        quantity: 0,
        unitPrice: 0,
        note: ''
      });

      // Reload materials
      await loadMaterials();

    } catch (error) {
      console.error('Error creating material:', error);
      toast.error('Có lỗi xảy ra khi tạo vật tư mới');
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

  const selectedMaterial = materials.find(m => m.id === importForm.materialId);
  const totalAmount = importForm.quantity * importForm.unitPrice;
  const newMaterialTotalAmount = newMaterialForm.quantity * newMaterialForm.unitPrice;

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
      {/* Enhanced Header */}
      <header className="sticky top-0 z-50 border-b border-white/20 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:bg-slate-900/80 dark:supports-[backdrop-filter]:bg-slate-900/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center space-x-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="hover:bg-white/50 dark:hover:bg-slate-800/50"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Quay lại
              </Button>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="h-12 w-12 bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Package className="h-7 w-7 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 h-4 w-4 bg-orange-500 rounded-full flex items-center justify-center">
                    <Plus className="h-2.5 w-2.5 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    Nhập vật tư
                  </h1>
                  <p className="text-sm text-muted-foreground">Quản lý và nhập vật tư mới</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="bg-white/50 dark:bg-slate-800/50">
                {materials.length} vật tư
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Quick Stats */}
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                    <Package2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tổng vật tư</p>
                    <p className="text-2xl font-bold">{materials.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl">
                    <AlertCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tồn kho thấp</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {materials.filter(m => m.currentStock < 10).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Giá trị kho</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(materials.reduce((sum, m) => sum + (m.currentStock * m.unitPrice), 0))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mode Selection */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">Chọn loại thao tác</CardTitle>
                  <CardDescription>Bạn muốn nhập vật tư đã có hay tạo vật tư mới?</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  variant={importMode === 'existing' ? 'default' : 'outline'}
                  onClick={() => setImportMode('existing')}
                  className={`h-24 flex-col space-y-3 ${
                    importMode === 'existing' 
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700' 
                      : 'hover:bg-blue-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <ShoppingCart className="h-8 w-8" />
                  <div className="text-center">
                    <div className="font-semibold">Nhập vật tư có sẵn</div>
                    <div className="text-sm opacity-80">Bổ sung tồn kho</div>
                  </div>
                </Button>
                <Button
                  variant={importMode === 'new' ? 'default' : 'outline'}
                  onClick={() => setImportMode('new')}
                  className={`h-24 flex-col space-y-3 ${
                    importMode === 'new' 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600' 
                      : 'hover:bg-green-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Plus className="h-8 w-8" />
                  <div className="text-center">
                    <div className="font-semibold">Tạo vật tư mới</div>
                    <div className="text-sm opacity-80">Thêm loại mới</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Import Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Import Existing Material */}
              {importMode === 'existing' && (
                <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
                  <CardHeader className="pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                        <ShoppingCart className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Nhập vật tư có sẵn</CardTitle>
                        <CardDescription>Chọn vật tư và nhập số lượng cần bổ sung</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="material-select">Chọn vật tư</Label>
                      <Select
                        value={importForm.materialId}
                        onValueChange={handleMaterialSelect}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Chọn vật tư cần nhập" />
                        </SelectTrigger>
                        <SelectContent>
                          {materials.map((material) => (
                            <SelectItem key={material.id} value={material.id!}>
                              <div className="flex items-center justify-between w-full">
                                <span className="font-medium">{material.name}</span>
                                <div className="flex items-center space-x-2 ml-4">
                                  <Badge 
                                    variant={material.currentStock < 10 ? "destructive" : "secondary"}
                                    className="text-xs"
                                  >
                                    {material.currentStock} {material.unit}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">
                                    {formatCurrency(material.unitPrice)}
                                  </span>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedMaterial && (
                      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-800 dark:text-blue-200">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <strong>Tồn kho hiện tại:</strong><br />
                              {selectedMaterial.currentStock} {selectedMaterial.unit}
                            </div>
                            <div>
                              <strong>Đơn giá hiện tại:</strong><br />
                              {formatCurrency(selectedMaterial.unitPrice)}
                            </div>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Số lượng nhập</Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="0"
                          step="1"
                          value={importForm.quantity || ''}
                          onChange={(e) => setImportForm(prev => ({
                            ...prev,
                            quantity: parseFloat(e.target.value) || 0
                          }))}
                          placeholder="Nhập số lượng"
                          className="h-12"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="unit-price">Đơn giá</Label>
                        <Input
                          id="unit-price"
                          type="number"
                          min="0"
                          step="1000"
                          value={importForm.unitPrice || ''}
                          onChange={(e) => setImportForm(prev => ({
                            ...prev,
                            unitPrice: parseFloat(e.target.value) || 0
                          }))}
                          placeholder="Đơn giá"
                          className="h-12"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="note">Ghi chú (tùy chọn)</Label>
                      <Textarea
                        id="note"
                        value={importForm.note}
                        onChange={(e) => setImportForm(prev => ({
                          ...prev,
                          note: e.target.value
                        }))}
                        placeholder="Ghi chú về lô hàng này..."
                        rows={3}
                        className="resize-none"
                      />
                    </div>

                    {importForm.quantity > 0 && importForm.unitPrice > 0 && (
                      <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800 dark:text-green-200">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <strong>Tổng tiền:</strong><br />
                              <span className="text-lg font-bold">{formatCurrency(totalAmount)}</span>
                            </div>
                            {selectedMaterial && (
                              <div>
                                <strong>Tồn kho sau nhập:</strong><br />
                                <span className="text-lg font-bold">
                                  {selectedMaterial.currentStock + importForm.quantity} {selectedMaterial.unit}
                                </span>
                              </div>
                            )}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button 
                      onClick={handleImportExisting}
                      disabled={!importForm.materialId || !importForm.quantity || !importForm.unitPrice || isSubmitting}
                      className="w-full h-12 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                          Đang xử lý...
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="h-5 w-5 mr-2" />
                          Nhập vật tư
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Create New Material */}
              {importMode === 'new' && (
                <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
                  <CardHeader className="pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
                        <Plus className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Tạo vật tư mới</CardTitle>
                        <CardDescription>Thêm loại vật tư mới vào hệ thống</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="material-name">Tên vật tư</Label>
                        <Input
                          id="material-name"
                          value={newMaterialForm.name}
                          onChange={(e) => setNewMaterialForm(prev => ({
                            ...prev,
                            name: e.target.value
                          }))}
                          placeholder="Ví dụ: Chai thủy tinh 500ml"
                          className="h-12"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="material-unit">Đơn vị tính</Label>
                        <Input
                          id="material-unit"
                          value={newMaterialForm.unit}
                          onChange={(e) => setNewMaterialForm(prev => ({
                            ...prev,
                            unit: e.target.value
                          }))}
                          placeholder="Ví dụ: chai, kg, hộp"
                          className="h-12"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="new-quantity">Số lượng nhập</Label>
                        <Input
                          id="new-quantity"
                          type="number"
                          min="0"
                          step="1"
                          value={newMaterialForm.quantity || ''}
                          onChange={(e) => setNewMaterialForm(prev => ({
                            ...prev,
                            quantity: parseFloat(e.target.value) || 0
                          }))}
                          placeholder="Số lượng"
                          className="h-12"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="new-unit-price">Đơn giá</Label>
                        <Input
                          id="new-unit-price"
                          type="number"
                          min="0"
                          step="1000"
                          value={newMaterialForm.unitPrice || ''}
                          onChange={(e) => setNewMaterialForm(prev => ({
                            ...prev,
                            unitPrice: parseFloat(e.target.value) || 0
                          }))}
                          placeholder="Đơn giá"
                          className="h-12"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-note">Ghi chú (tùy chọn)</Label>
                      <Textarea
                        id="new-note"
                        value={newMaterialForm.note}
                        onChange={(e) => setNewMaterialForm(prev => ({
                          ...prev,
                          note: e.target.value
                        }))}
                        placeholder="Mô tả về vật tư này..."
                        rows={3}
                        className="resize-none"
                      />
                    </div>

                    {newMaterialForm.quantity > 0 && newMaterialForm.unitPrice > 0 && (
                      <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800 dark:text-green-200">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <strong>Tổng tiền:</strong><br />
                              <span className="text-lg font-bold">{formatCurrency(newMaterialTotalAmount)}</span>
                            </div>
                            <div>
                              <strong>Tồn kho ban đầu:</strong><br />
                              <span className="text-lg font-bold">
                                {newMaterialForm.quantity} {newMaterialForm.unit}
                              </span>
                            </div>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button 
                      onClick={handleCreateNewMaterial}
                      disabled={!newMaterialForm.name || !newMaterialForm.unit || !newMaterialForm.quantity || !newMaterialForm.unitPrice || isSubmitting}
                      className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                          Đang tạo...
                        </>
                      ) : (
                        <>
                          <Plus className="h-5 w-5 mr-2" />
                          Tạo vật tư mới
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Materials List Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
                <CardHeader className="pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
                      <Package className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Vật tư hiện có</CardTitle>
                      <CardDescription>Quản lý danh sách vật tư</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search and Filter */}
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Tìm kiếm vật tư..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10"
                      />
                    </div>
                    
                    <Select value={stockFilter} onValueChange={(value: 'all' | 'low' | 'normal') => setStockFilter(value)}>
                      <SelectTrigger className="h-10">
                        <div className="flex items-center">
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả vật tư</SelectItem>
                        <SelectItem value="low">Tồn kho thấp</SelectItem>
                        <SelectItem value="normal">Tồn kho bình thường</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Materials List */}
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredMaterials.length === 0 ? (
                      <div className="text-center py-8">
                        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground">
                          {searchTerm || stockFilter !== 'all' 
                            ? 'Không tìm thấy vật tư phù hợp' 
                            : 'Chưa có vật tư nào trong hệ thống'
                          }
                        </p>
                      </div>
                    ) : (
                      filteredMaterials.map((material, index) => (
                        <div
                          key={material.id}
                          className="group relative p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 bg-white/50 dark:bg-slate-800/50"
                          style={{
                            animationDelay: `${index * 50}ms`,
                            animation: 'slideInRight 0.4s ease-out forwards'
                          }}
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                                  {material.name}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {formatCurrency(material.unitPrice)}
                                </p>
                              </div>
                              <div className="flex items-center space-x-1 ml-2">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20"
                                      disabled={isDeleting}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Xác nhận xóa vật tư</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Bạn có chắc chắn muốn xóa vật tư "{material.name}"? 
                                        Hành động này không thể hoàn tác.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Hủy</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteMaterial(material.id!, material.name)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Xóa
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <Badge 
                                variant={material.currentStock < 10 ? "destructive" : "secondary"}
                                className={`${
                                  material.currentStock < 10 
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300' 
                                    : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                                }`}
                              >
                                {material.currentStock} {material.unit}
                              </Badge>
                              {material.currentStock < 10 && (
                                <div className="flex items-center text-xs text-orange-600 dark:text-orange-400">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Sắp hết
                                </div>
                              )}
                            </div>

                            {/* Stock Level Progress Bar */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Mức tồn kho</span>
                                <span>{material.currentStock}/50</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all duration-1000 ease-out ${
                                    material.currentStock < 10 
                                      ? 'bg-gradient-to-r from-red-500 to-orange-500' 
                                      : 'bg-gradient-to-r from-green-500 to-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min((material.currentStock / 50) * 100, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>

                          {/* Pulse effect for low stock items */}
                          {material.currentStock < 5 && (
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl opacity-20 animate-pulse"></div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {materials.length > 0 && (
                    <div className="pt-4 border-t">
                      <div className="text-center text-sm text-muted-foreground">
                        Hiển thị {filteredMaterials.length} / {materials.length} vật tư
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Additional Info Cards */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Mẹo quản lý tồn kho</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Nhập vật tư định kỳ để tránh thiếu hụt</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Theo dõi vật tư sắp hết để kịp thời bổ sung</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Cập nhật đơn giá theo thị trường</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Ghi chú chi tiết cho mỗi lần nhập</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20">
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Cảnh báo quan trọng</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start space-x-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span>Không thể hoàn tác sau khi xóa vật tư</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span>Kiểm tra kỹ thông tin trước khi nhập</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span>Vật tư có tồn kho thấp cần được ưu tiên</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span>Backup dữ liệu thường xuyên</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Custom animations */}
      <style jsx>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}