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
  ArrowLeft, 
  Package, 
  Plus, 
  Minus,
  AlertCircle,
  CheckCircle,
  ShoppingCart
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
  const [user, loading, error] = useAuthState(auth);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [importMode, setImportMode] = useState<'existing' | 'new'>('existing');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
                <Package className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-semibold">Nhập vật tư</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Mode Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Chọn loại nhập</CardTitle>
              <CardDescription>
                Bạn muốn nhập vật tư đã có hay tạo vật tư mới?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant={importMode === 'existing' ? 'default' : 'outline'}
                  onClick={() => setImportMode('existing')}
                  className="h-20 flex-col space-y-2"
                >
                  <ShoppingCart className="h-6 w-6" />
                  <span>Nhập vật tư có sẵn</span>
                </Button>
                <Button
                  variant={importMode === 'new' ? 'default' : 'outline'}
                  onClick={() => setImportMode('new')}
                  className="h-20 flex-col space-y-2"
                >
                  <Plus className="h-6 w-6" />
                  <span>Tạo vật tư mới</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Import Existing Material */}
          {importMode === 'existing' && (
            <Card>
              <CardHeader>
                <CardTitle>Nhập vật tư có sẵn</CardTitle>
                <CardDescription>
                  Chọn vật tư và nhập số lượng cần bổ sung
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="material-select">Chọn vật tư</Label>
                  <Select
                    value={importForm.materialId}
                    onValueChange={handleMaterialSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn vật tư cần nhập" />
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map((material) => (
                        <SelectItem key={material.id} value={material.id!}>
                          <div className="flex items-center justify-between w-full">
                            <span>{material.name}</span>
                            <div className="flex items-center space-x-2 ml-4">
                              <Badge variant="secondary">
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
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Tồn kho hiện tại: <strong>{selectedMaterial.currentStock} {selectedMaterial.unit}</strong>
                      <br />
                      Đơn giá hiện tại: <strong>{formatCurrency(selectedMaterial.unitPrice)}</strong>
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
                  />
                </div>

                {importForm.quantity > 0 && importForm.unitPrice > 0 && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <div>Tổng tiền: <strong>{formatCurrency(totalAmount)}</strong></div>
                        {selectedMaterial && (
                          <div>
                            Tồn kho sau nhập: <strong>
                              {selectedMaterial.currentStock + importForm.quantity} {selectedMaterial.unit}
                            </strong>
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <Separator />

                <Button 
                  onClick={handleImportExisting}
                  disabled={!importForm.materialId || !importForm.quantity || !importForm.unitPrice || isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? 'Đang xử lý...' : 'Nhập vật tư'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Create New Material */}
          {importMode === 'new' && (
            <Card>
              <CardHeader>
                <CardTitle>Tạo vật tư mới</CardTitle>
                <CardDescription>
                  Thêm loại vật tư mới vào hệ thống
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  />
                </div>

                {newMaterialForm.quantity > 0 && newMaterialForm.unitPrice > 0 && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <div>Tổng tiền: <strong>{formatCurrency(newMaterialTotalAmount)}</strong></div>
                        <div>
                          Sẽ tạo vật tú mới với tồn kho ban đầu: <strong>
                            {newMaterialForm.quantity} {newMaterialForm.unit}
                          </strong>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <Separator />

                <Button 
                  onClick={handleCreateNewMaterial}
                  disabled={!newMaterialForm.name || !newMaterialForm.unit || !newMaterialForm.quantity || !newMaterialForm.unitPrice || isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Tạo vật tư mới'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Current Materials List */}
          <Card>
            <CardHeader>
              <CardTitle>Vật tư hiện có</CardTitle>
              <CardDescription>
                Danh sách các vật tư đang có trong kho
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {materials.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Chưa có vật tư nào trong hệ thống
                  </p>
                ) : (
                  materials.map((material) => (
                    <div
                      key={material.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{material.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Đơn giá: {formatCurrency(material.unitPrice)}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={material.currentStock < 10 ? "destructive" : "secondary"}
                        >
                          {material.currentStock} {material.unit}
                        </Badge>
                        {material.currentStock < 10 && (
                          <p className="text-xs text-orange-600 mt-1">Sắp hết</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}