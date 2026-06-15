"use client"

// Barrel file — re-exports all sidebar components so that
// `import { … } from "@/components/ui/sidebar"` still works.

// From sidebar-context
export { SidebarContext, SidebarProvider, useSidebar } from "../sidebar-context"

// From sidebar-menu
export {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  sidebarMenuButtonVariants,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "../sidebar-menu"

// Local sub-components
export { Sidebar } from "./sidebar"
export { SidebarTrigger, SidebarRail } from "./sidebar-trigger"
export { SidebarInset, SidebarInput } from "./sidebar-layout"
export { SidebarHeader, SidebarFooter, SidebarContent, SidebarSeparator } from "./sidebar-structural"
export { SidebarGroup, SidebarGroupLabel, SidebarGroupAction, SidebarGroupContent } from "./sidebar-group"
