import bpy
import fnmatch
import time
from random import randint

class TEST_OT_Operator(bpy.types.Operator):
	bl_idname = "view3d.cursor_center"
	bl_label  = "Simple operator"
	bl_descripton = "Generate Courrier"

	def execute(self,context):
		bpy.ops.view3d.snap_cursor_to_center()
		scene = context.scene
		objects = bpy.context.selected_objects
		bpy.ops.mesh.separate(type='LOOSE')
		mat = bpy.data.materials.new(name="basic"+str(randint(0, 9))) #set new material to variable

		for object in objects:
			skin = object.modifiers.new(type='SKIN', name='sv_skin')




		for object in objects:
			decimate_first = object.modifiers.new(type='DECIMATE', name='decimate_first')
			decimate_first.decimate_type = 'UNSUBDIV'
			decimate_first.iterations = 1

			subs_first = object.modifiers.new(type='SUBSURF', name='subsurface1')

			decimate_sec = object.modifiers.new(type='DECIMATE', name='decimate_sec')
			decimate_sec.decimate_type = 'UNSUBDIV'
			decimate_sec.iterations = 1

			subs_sec = object.modifiers.new(type='SUBSURF', name='subsurface2')

			object.data.materials.append(mat) #add the material to the object
			bpy.context.object.active_material.diffuse_color = (0, 1, 0) #change color

		return{'FINISHED'} 

class FINISH_OT_Operator(bpy.types.Operator):
	bl_idname = "view3d.cursor_center"
	bl_label  = "Simple operator"
	bl_descripton = "Generate Cylinder"

	def execute(self,context):
		scene = context.scene
		objects = bpy.context.selected_objects
		return{'FINISHED'} 