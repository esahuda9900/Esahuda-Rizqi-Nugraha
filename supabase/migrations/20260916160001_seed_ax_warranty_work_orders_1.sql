-- Seed chunk 1/3 for Dynamics AX warranty work orders.
INSERT INTO public.ax_warranty_work_orders (wo_no,created_at_source,created_date,start_date,chassis_no,serial_no,case_group,wo_type,status,description,device_name,delivery_name,custodian,customer_account,device_number,person_in_charge,primary_resource,primary_resource_group,estimated_hours,brand_number,location,location2,mobile_phone,telephone,name,source_row_number)
VALUES
('WO24031365','10/2/24 11:59','2024-10-02','2024-10-02','620372','620372','WMSDLG','WAR','Closed','REPLACE MOTOR FAN - SDLG L956F (620372)','SDLG WHEEL LOADER','GREAT GIANT PINEAPPLE PT','GREAT GIANT PINEAPPLE PT','0332','ITR-000011711','Titus Buang Sihono','Jkt_Field','ITR - JAKARTA BRANCH',4.0,'SDLG','JAKARTA',NULL,NULL,'(0725) 7573001, 0821',NULL,3),
('WO24031462','10/9/24 12:47','2024-10-09','2024-10-09','VLGE606FJN0625757','625757','WMSDLG','MW','Canceled','Install Software & Replace Ecu','SDLG COMPACT EXCAVATOR','FADEL MUHAMAD NAKU','FADEL MUHAMAD NAKU','3735','ITR-000011748','Reynold Alexander','Makasar_Field','ITR - MAKASAR',17.5,'SDLG','MAKASAR','PALU',NULL,NULL,NULL,4)
ON CONFLICT (wo_no) DO UPDATE SET updated_at=now();
