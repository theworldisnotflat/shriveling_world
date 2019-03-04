import bpy

class TEST_PT_Panel(bpy.types.Panel):
	bl_idname = "Test_PT_Panel"
	bl_label = "LineToCylinder"
	bl_space_type = "VIEW_3D"
	bl_region_type = "UI"
	bl_category = "LineToCylinder"

	def draw(self, context):
		layout = self.layout
		row = layout.row()
		row.operator('view3d.cursor_center', text="Generate Cylinder from Line")

class FINISH_PT_Panel(bpy.types.Panel):
	bl_idname = "Finish_PT_Panel"
	bl_label = "Finish"
	bl_space_type = "VIEW_3D"
	bl_region_type = "UI"
	bl_category = "Test Addon"

	def draw(self, context):
		layout = self.layout
		row = layout.row()
		row.operator('view3d.cursor_center', text="Finish Cylinder from Line")