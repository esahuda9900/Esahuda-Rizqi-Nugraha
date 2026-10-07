UPDATE public.ax_warranty_work_orders
SET primary_resource_group='ITR - KENDARI', primary_resource='Kendari_Field', updated_at=now()
WHERE source_quality_status='OK' AND wo_no IN ('WO25037579','WO25037580');
