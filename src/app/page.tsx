'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Folder, FileText, Minus, X, Monitor, ChevronLeft, ChevronUp, Home, RefreshCcw, Clock, ChevronRight, Settings, HelpCircle, Power } from 'lucide-react'
import { cn } from '@/lib/utils'

type Vec2 = { x: number; y: number }

type WindowType = 'file-explorer' | 'notepad' | 'recycle-bin' | 'about' | 'image-viewer' | 'pdf-viewer'

type WinInstance = {
  id: string
  title: string
  type: WindowType
  position: Vec2
  size?: { w: number; h: number }
  minimized: boolean
  z: number
  payload?: WindowPayload
}

type WindowPayload = {
  initialPath?: string[]
  text?: string
  currentFile?: string
  filePath?: string
  fileType?: 'image' | 'pdf'
}

// Drag and drop types
type DragItem = {
  type: 'desktop-icon' | 'file-explorer-item'
  name: string
  path: string[]
  isFolder: boolean
  originalLocation: string[]
}

type DragState = {
  isDragging: boolean
  item: DragItem | null
  position: Vec2
  dragImage?: HTMLImageElement
}

function useZIndexManager() {
  const [counter, setCounter] = useState(10)
  const next = useCallback(() => {
    const newValue = counter + 1
    setCounter(newValue)
    return newValue
  }, [counter])
  return { next }
}

function useViewportSize() {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    function onResize() {
      setSize({ w: window.innerWidth, h: window.innerHeight })
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

function randPosition(offset = 40) {
  const x = Math.floor(80 + Math.random() * 120)
  const y = Math.floor(80 + Math.random() * 80)
  return { x: x + offset, y: y + offset }
}

// Fake filesystem for File Explorer
type FSFile = { type: 'file'; ext: string; size: number; content?: string }
type FSFolder = { type: 'folder'; children: Record<string, FSNode> }
type FSNode = FSFile | FSFolder

// Extended types for recycle bin items
type RecycledFile = FSFile & {
  originalPath?: string[]
  originalName?: string
  deletedAt?: string
}

type RecycledFolder = FSFolder & {
  originalPath?: string[]
  originalName?: string
  deletedAt?: string
}

type RecycledNode = RecycledFile | RecycledFolder

// Default file system structure
const DEFAULT_FS_ROOT: FSFolder = {
  type: 'folder',
  children: {
    'C:': {
      type: 'folder',
      children: {
        Desktop: {
          type: 'folder',
          children: {
            'My Computer.lnk': { type: 'file', ext: 'lnk', size: 1024 },
            'Documents.lnk': { type: 'file', ext: 'lnk', size: 1024 },
            'Notepad.lnk': { type: 'file', ext: 'lnk', size: 1024 },
            'Recycle Bin.lnk': { type: 'file', ext: 'lnk', size: 1024 },
            'About.lnk': { type: 'file', ext: 'lnk', size: 1024 },
          },
        },
        Documents: {
          type: 'folder',
          children: {
            'CV/Resume.pdf': { type: 'file', ext: 'pdf', size: 28_672 },
          },
        },
        Pictures: {
          type: 'folder',
          children: {
            'Image of Liam.jpg': { type: 'file', ext: 'jpg', size: 1_600_000 },
          },
        },
      },
    },
  },
}

// Function to load file system from localStorage
function loadFileSystem(): FSFolder {
  if (typeof window === 'undefined') return DEFAULT_FS_ROOT
  
  try {
    const saved = localStorage.getItem('win95-filesystem')
    if (saved) {
      const parsed = JSON.parse(saved)
      return parsed
    }
  } catch (error) {
    console.error('Error loading file system from localStorage:', error)
  }
  
  return DEFAULT_FS_ROOT
}

// Function to save file system to localStorage
function saveFileSystem(fs: FSFolder) {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem('win95-filesystem', JSON.stringify(fs))
  } catch (error) {
    console.error('Error saving file system to localStorage:', error)
  }
}

// Initialize file system
const FS_ROOT = loadFileSystem()

function getNodeByPath(root: FSFolder, path: string[]): FSNode | null {
  if (path.length === 0) return root
  let cur: FSNode = root
  for (const p of path) {
    if (cur.type !== 'folder') return null
    const folder = cur as FSFolder
    const nextNode: FSNode | undefined = folder.children[p]
    if (!nextNode) return null
    cur = nextNode
  }
  return cur
}

// File system management functions
function createFile(root: FSFolder, path: string[], filename: string, content: string): boolean {
  const folder = getNodeByPath(root, path)
  if (!folder || folder.type !== 'folder') return false
  
  const newFile: FSFile = {
    type: 'file',
    ext: 'txt',
    size: content.length,
    content: content
  }
  
  folder.children[filename] = newFile
  saveFileSystem(root)
  return true
}

function updateFile(root: FSFolder, path: string[], filename: string, content: string): boolean {
  const folder = getNodeByPath(root, path)
  if (!folder || folder.type !== 'folder') return false
  
  const file = folder.children[filename]
  if (!file || file.type !== 'file') return false
  
  file.size = content.length
  file.content = content
  saveFileSystem(root)
  return true
}

// Recycle bin operations
function moveToRecycleBin(root: FSFolder, itemPath: string[], itemName: string): boolean {
  // Get the source folder
  const sourceFolder = getNodeByPath(root, itemPath)
  if (!sourceFolder || sourceFolder.type !== 'folder') return false
  
  // Get the item to move
  const item = sourceFolder.children[itemName]
  if (!item) return false
  
  // Create recycle bin if it doesn't exist
  if (!root.children['Recycle Bin']) {
    root.children['Recycle Bin'] = {
      type: 'folder',
      children: {}
    }
  }
  
  // Add timestamp to avoid name conflicts
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const recycledName = `${itemName}_${timestamp}`
  
  // Move item to recycle bin with metadata
  const recycledItem: RecycledNode = {
    ...item,
    originalPath: itemPath,
    originalName: itemName,
    deletedAt: new Date().toISOString()
  }
  
  const recycleBin = root.children['Recycle Bin'] as FSFolder
  recycleBin.children[recycledName] = recycledItem
  
  // Remove from original location
  delete sourceFolder.children[itemName]
  
  saveFileSystem(root)
  return true
}

function restoreFromRecycleBin(root: FSFolder, recycledName: string): boolean {
  const recycleBin = root.children['Recycle Bin']
  if (!recycleBin || recycleBin.type !== 'folder') return false
  
  const recycledItem = recycleBin.children[recycledName] as RecycledNode
  if (!recycledItem) return false
  
  // Get original location
  const originalPath = recycledItem.originalPath || []
  const originalName = recycledItem.originalName || recycledName
  
  // Get or create the destination folder
  let destinationFolder = root
  if (originalPath.length > 0) {
    const destNode = getNodeByPath(root, originalPath)
    if (!destNode || destNode.type !== 'folder') return false
    destinationFolder = destNode
  }
  
  // Restore the item (remove recycle bin metadata)
  const restoredItem: FSNode = recycledItem.type === 'file' ? {
    type: 'file',
    ext: recycledItem.ext,
    size: recycledItem.size,
    content: recycledItem.content
  } : {
    type: 'folder',
    children: (recycledItem as RecycledFolder).children
  }
  
  destinationFolder.children[originalName] = restoredItem
  
  // Remove from recycle bin
  delete recycleBin.children[recycledName]
  
  saveFileSystem(root)
  return true
}

function emptyRecycleBin(root: FSFolder): boolean {
  if (root.children['Recycle Bin']) {
    root.children['Recycle Bin'] = {
      type: 'folder',
      children: {}
    }
    saveFileSystem(root)
    return true
  }
  return false
}

// Removed unused function generateUniqueFilename

function Windows95Raised({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={cn(
        // Raised bevel: light top/left, dark bottom/right
        'border border-t-white border-l-white border-r-[#404040] border-b-[#404040] bg-[#c0c0c0]',
        className
      )}
    >
      {children}
    </div>
  )
}

function Windows95Inset({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn('border border-t-[#404040] border-l-[#404040] border-r-white border-b-white bg-[#c0c0c0]', className)}>
      {children}
    </div>
  )
}

function TitleBarButton({
  onClick,
  'aria-label': ariaLabel,
  children,
}: {
  onClick?: () => void
  'aria-label'?: string
  children: React.ReactNode
}) {
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      className="h-5 w-5 items-center justify-center inline-flex bg-[#c0c0c0] border border-t-white border-l-white border-r-[#404040] border-b-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-r-white active:border-b-white"
    >
      {children}
    </button>
  )
}

function Window95({
  id,
  title,
  position,
  z,
  minimized,
  onMouseDown,
  onClose,
  onMinimize,
  onDragMove,
  children,
  initialSize,
}: {
  id: string
  title: string
  position: Vec2
  z: number
  minimized: boolean
  onMouseDown: (id: string) => void
  onClose: (id: string) => void
  onMinimize: (id: string) => void
  onDragMove: (id: string, pos: Vec2) => void
  initialSize?: { w: number; h: number }
  children: React.ReactNode
}) {
  const dragStart = useRef<{ offset: Vec2 } | null>(null)

  const onTitleMouseDown = (e: React.MouseEvent) => {
    onMouseDown(id)
    const startX = e.clientX
    const startY = e.clientY
    const offset = { x: startX - position.x, y: startY - position.y }
    dragStart.current = { offset }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const onMouseMove = (e: MouseEvent) => {
    if (!dragStart.current) return
    const nx = e.clientX - dragStart.current.offset.x
    const ny = e.clientY - dragStart.current.offset.y
    onDragMove(id, { x: Math.max(0, nx), y: Math.max(0, ny) })
  }

  const onMouseUp = () => {
    dragStart.current = null
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  if (minimized) return null

  return (
    <div
      role="dialog"
      aria-label={title}
      className="absolute select-none"
      style={{
        left: position.x,
        top: position.y,
        zIndex: z,
        width: initialSize?.w ?? 640,
        height: initialSize?.h ?? 420,
      }}
      onMouseDown={() => onMouseDown(id)}
    >
      <Windows95Raised className="h-full w-full">
        <div
          className="flex items-center justify-between h-6 px-1 text-white cursor-move"
          style={{ backgroundColor: '#000080' }}
          onMouseDown={onTitleMouseDown}
        >
          <div className="flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5" aria-hidden />
            <span className="text-xs font-semibold">{title}</span>
          </div>
          <div className="flex items-center gap-1">
            <TitleBarButton aria-label="Minimize" onClick={() => onMinimize(id)}>
              <Minus className="w-3 h-3" />
            </TitleBarButton>
            <TitleBarButton aria-label="Close" onClick={() => onClose(id)}>
              <X className="w-3 h-3" />
            </TitleBarButton>
          </div>
        </div>
        <div className="p-1 h-[calc(100%-1.5rem)] bg-[#c0c0c0]">
          <Windows95Inset className="w-full h-full overflow-auto">{children}</Windows95Inset>
        </div>
      </Windows95Raised>
    </div>
  )
}

function DesktopIcon({
  title = 'App',
  onOpen = () => {},
  icon: Icon = Folder,
  imgSrc,
  imgAlt,
  selected = false,
  onSelect = () => {},
  className,
  draggable = false,
  onStartDrag,
  dragItem,
  iconKey,
}: {
  title?: string
  onOpen?: () => void
  icon?: React.ComponentType<{ className?: string }>
  imgSrc?: string
  imgAlt?: string
  selected?: boolean
  onSelect?: () => void
  className?: string
  draggable?: boolean
  onStartDrag?: (item: DragItem, position: Vec2) => void
  dragItem?: DragItem
  iconKey?: string
}) {
  const lastClickRef = useRef(0)
  const dragStartRef = useRef<Vec2 | null>(null)
  
  const handleClick = () => {
    const now = Date.now()
    if (now - lastClickRef.current < 300) {
      onOpen()
    } else {
      onSelect()
    }
    lastClickRef.current = now
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!draggable || !dragItem || !onStartDrag) return
    
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return
      
      const deltaX = Math.abs(e.clientX - dragStartRef.current.x)
      const deltaY = Math.abs(e.clientY - dragStartRef.current.y)
      
      // Start drag if moved more than 5 pixels
      if (deltaX > 5 || deltaY > 5) {
        onStartDrag(dragItem, { x: e.clientX, y: e.clientY })
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
    
    const handleMouseUp = () => {
      dragStartRef.current = null
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <button
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      className={cn(
        'flex flex-col items-center justify-start gap-1 p-1.5 rounded outline-none focus:ring-2 focus:ring-emerald-400 w-22 h-26',
        { 'bg-black/20': selected },
        { 'cursor-grab active:cursor-grabbing': draggable },
        className
      )}
      aria-label={title}
      title={title}
      data-icon={iconKey}
    >
      {imgSrc ? (
        <Image
          src={imgSrc || '/placeholder.svg?height=40&width=40'}
          alt={imgAlt || title}
          width={64}
          height={64}
          className="w-13 h-13 object-contain"
          draggable={false}
        />
      ) : (
        <Icon className="w-13 h-13 text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]" />
      )}
      <span className="text-sm text-white text-center leading-tight drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]">
        {title}
      </span>
    </button>
  )
}

function StartMenu({
  isOpen,
  onClose,
  onOpenApp,
}: {
  isOpen: boolean
  onClose: () => void
  onOpenApp: (type: WindowType, payload?: WindowPayload) => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const menuItems = [
    {
      label: 'Programs',
      icon: Folder,
      hasSubmenu: true,
      submenu: [
        { label: 'Accessories', icon: Folder },
        { label: 'Games', icon: Folder },
        { label: 'StartUp', icon: Folder },
      ]
    },
    {
      label: 'Documents',
      icon: FileText,
      action: () => onOpenApp('file-explorer', { initialPath: ['C:', 'Documents'] })
    },
    {
      label: 'Settings',
      icon: Settings,
      hasSubmenu: true,
      submenu: [
        { label: 'Control Panel', icon: Settings },
        { label: 'Printers', icon: Settings },
        { label: 'Taskbar', icon: Settings },
      ]
    },
    {
      label: 'Find',
      icon: HelpCircle,
      hasSubmenu: true,
      submenu: [
        { label: 'Files or Folders...', icon: FileText },
        { label: 'Computer...', icon: Monitor },
      ]
    },
    {
      label: 'Help',
      icon: HelpCircle,
      action: () => onOpenApp('about')
    },
    {
      label: 'Run...',
      icon: FileText,
      action: () => {
        // For demo, just open notepad
        onOpenApp('notepad', { text: 'Run dialog would appear here.\n\nThis is a demo of the Windows 95 start menu.' })
      }
    },
    {
      label: 'Shut Down...',
      icon: Power,
      action: () => {
        // For demo, just show an alert
        alert('Shut Down dialog would appear here.')
      }
    }
  ]

  return (
    <div className="fixed bottom-10 left-2 z-[10000]" ref={menuRef}>
      <Windows95Raised className="w-64 max-h-96">
        <div className="bg-[#c0c0c0] p-1">
          <div className="text-xs font-bold text-black mb-2 px-2 py-1">
            Windows 95
          </div>
          <div className="space-y-1">
            {menuItems.map((item, index) => (
              <StartMenuItem
                key={index}
                item={item}
                onClose={onClose}
              />
            ))}
          </div>
        </div>
      </Windows95Raised>
    </div>
  )
}

function Taskbar({
  windows = [],
  onToggleMinimize = () => {},
  onFocus = () => {},
  onStartClick = () => {},
  isStartMenuOpen = false,
}: {
  windows?: WinInstance[]
  onToggleMinimize?: (id: string) => void
  onFocus?: (id: string) => void
  onStartClick?: () => void
  isStartMenuOpen?: boolean
}) {
  const [time, setTime] = useState<string>('')

  useEffect(() => {
    const update = () => {
      const d = new Date()
      const hh = d.getHours().toString().padStart(2, '0')
      const mm = d.getMinutes().toString().padStart(2, '0')
      setTime(`${hh}:${mm}`)
    }
    update()
    const t = setInterval(update, 15_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16" style={{ zIndex: 9999 }}>
      <Windows95Raised className="h-full w-full px-3 flex items-center gap-3">
        <button
          onClick={onStartClick}
          className={cn(
            "px-4 py-2 text-base bg-[#c0c0c0] border border-t-white border-l-white border-r-[#404040] border-b-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-r-white active:border-b-white flex items-center gap-2",
            isStartMenuOpen && "border-t-[#404040] border-l-[#404040] border-r-white border-b-white"
          )}
          aria-label="Start"
        >
          <Home className="w-5 h-5" />
          Start
        </button>
        <div className="flex-1 flex items-center gap-2 overflow-x-auto">
          {windows.map((w) => (
            <button
              key={w.id}
              onClick={() => {
                // If minimized, restore; else minimize
                onToggleMinimize(w.id)
                onFocus(w.id)
              }}
                              className={cn(
                  'px-4 py-2 text-base whitespace-nowrap bg-[#c0c0c0] border border-t-white border-l-white border-r-[#404040] border-b-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-r-white active:border-b-white',
                  {
                    'border-t-[#404040] border-l-[#404040] border-r-white border-b-white':
                      !w.minimized, // appear pressed if active
                  }
                )}
              aria-label={`${w.title} taskbar button`}
              title={w.title}
            >
              {w.title}
            </button>
          ))}
        </div>
        <Windows95Inset className="px-3 py-2 flex items-center gap-2 min-w-[96px] justify-end">
          <Clock className="w-5 h-5" aria-hidden />
          <span className="text-base tabular-nums">{time}</span>
        </Windows95Inset>
      </Windows95Raised>
    </div>
  )
}

function StartMenuItem({
  item,
  onClose,
}: {
  item: {
    label: string
    icon: React.ComponentType<{ className?: string }>
    action?: () => void
    hasSubmenu?: boolean
    submenu?: Array<{ label: string; icon: React.ComponentType<{ className?: string }> }>
  }
  onClose: () => void
}) {
  const [showSubmenu, setShowSubmenu] = useState(false)
  const Icon = item.icon

  const handleClick = () => {
    if (item.action) {
      item.action()
      onClose()
    } else if (item.hasSubmenu) {
      console.log('Toggling submenu for:', item.label, 'Current state:', showSubmenu)
      setShowSubmenu(!showSubmenu)
    }
  }

  const handleMouseEnter = () => {
    if (item.hasSubmenu) {
      setShowSubmenu(true)
    }
  }

  const handleMouseLeave = () => {
    // Only hide submenu if we're not hovering over the submenu itself
    setTimeout(() => {
      const submenuElement = document.querySelector('[data-submenu]')
      if (!submenuElement?.matches(':hover')) {
        setShowSubmenu(false)
      }
    }, 100)
  }

  return (
    <div className="relative" onMouseLeave={handleMouseLeave}>
      <button
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        className="w-full text-left px-2 py-1 text-sm hover:bg-[#000080] hover:text-white flex items-center gap-2"
      >
        <Icon className="w-4 h-4" />
        <span>{item.label}</span>
        {item.hasSubmenu && (
          <ChevronRight className="w-3 h-3 ml-auto" />
        )}
      </button>
      
      {showSubmenu && item.submenu && (
        <div 
          className="absolute left-full top-0 z-[10001]"
          data-submenu
          onMouseEnter={() => setShowSubmenu(true)}
          onMouseLeave={() => setShowSubmenu(false)}
          style={{ minWidth: '192px' }}
        >
          <Windows95Raised className="w-48">
            <div className="bg-[#c0c0c0] p-1">
              {item.submenu.map((subItem, subIndex) => {
                const SubIcon = subItem.icon
                return (
                  <button
                    key={subIndex}
                    className="w-full text-left px-2 py-1 text-sm hover:bg-[#000080] hover:text-white flex items-center gap-2"
                  >
                    <SubIcon className="w-4 h-4" />
                    <span>{subItem.label}</span>
                  </button>
                )
              })}
            </div>
          </Windows95Raised>
        </div>
      )}
    </div>
  )
}

function NotepadApp({ 
  text = 'Welcome to Windows 95 Notepad (demo).',
  onDesktopUpdate,
  onCreateFile,
  onUpdateFile,
  initialCurrentFile
}: { 
  text?: string
  onDesktopUpdate?: () => void
  onCreateFile?: (path: string[], filename: string, content: string) => boolean
  onUpdateFile?: (path: string[], filename: string, content: string) => boolean
  initialCurrentFile?: string
}) {
  const [content, setContent] = useState(text)
  const [currentFile, setCurrentFile] = useState<string | null>(initialCurrentFile || null)
  const [isModified, setIsModified] = useState(false)

  const handleNew = () => {
    if (isModified && currentFile) {
      const shouldSave = confirm('Do you want to save changes to the current file?')
      if (shouldSave) {
        handleSaveAs()
      }
    }
    setContent('')
    setCurrentFile(null)
    setIsModified(false)
  }

  const handleSave = () => {
    if (currentFile) {
      // Save current file
      if (onUpdateFile?.(['C:', 'Desktop'], currentFile, content) ?? false) {
        setIsModified(false)
        alert(`File "${currentFile}" saved`)
      } else {
        alert('Error saving file')
      }
    } else {
      // No current file, use Save As
      handleSaveAs()
    }
  }

  const handleSaveAs = () => {
    // Prompt user for filename
    const filename = prompt('Enter filename (without .txt extension):', currentFile ? currentFile.replace('.txt', '') : 'Untitled')
    
    if (filename === null) {
      // User cancelled
      return
    }
    
    if (filename.trim() === '') {
      alert('Please enter a valid filename')
      return
    }
    
    // Ensure .txt extension
    const fullFilename = filename.trim().endsWith('.txt') ? filename.trim() : `${filename.trim()}.txt`
    
    const desktopFolder = getNodeByPath(FS_ROOT, ['C:', 'Desktop'])
    if (desktopFolder && desktopFolder.type === 'folder') {
      const existingFiles = Object.keys(desktopFolder.children)
      
      // Check if file already exists (unless it's the current file)
      if (existingFiles.includes(fullFilename) && fullFilename !== currentFile) {
        const overwrite = confirm(`File "${fullFilename}" already exists. Do you want to overwrite it?`)
        if (!overwrite) {
          return
        }
      }
      
      // If it's the same file, update it; otherwise create new
      const success = fullFilename === currentFile 
        ? (onUpdateFile?.(['C:', 'Desktop'], fullFilename, content) ?? false)
        : (onCreateFile?.(['C:', 'Desktop'], fullFilename, content) ?? false)
      
      if (success) {
        setCurrentFile(fullFilename)
        setIsModified(false)
        alert(`File saved as "${fullFilename}" on Desktop`)
        // Trigger desktop update to show new icon
        onDesktopUpdate?.()
      } else {
        alert('Error saving file')
      }
    } else {
      alert('Error: Desktop folder not found')
    }
  }

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    setIsModified(true)
  }

  return (
    <div className="w-full h-full flex flex-col">
      <Windows95Raised className="px-2 py-1 mb-1">
        <div className="flex items-center justify-between">
          <div className="text-xs">File Edit View Help</div>
          <div className="flex gap-1">
            <button
              onClick={handleNew}
              className="px-2 py-0.5 text-xs bg-[#c0c0c0] border border-t-white border-l-white border-r-[#404040] border-b-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-r-white active:border-b-white"
            >
              New
            </button>
            <button
              onClick={handleSave}
              className="px-2 py-0.5 text-xs bg-[#c0c0c0] border border-t-white border-l-white border-r-[#404040] border-b-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-r-white active:border-b-white"
            >
              Save
            </button>
            <button
              onClick={handleSaveAs}
              className="px-2 py-0.5 text-xs bg-[#c0c0c0] border border-t-white border-l-white border-r-[#404040] border-b-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-r-white active:border-b-white"
            >
              Save As
            </button>
          </div>
        </div>
      </Windows95Raised>
      <div className="flex-1 bg-white p-2 font-mono text-sm overflow-auto">
        <textarea
          value={content}
          onChange={handleContentChange}
          className="w-full h-full bg-white border-none outline-none resize-none font-mono text-sm"
          placeholder="Type your text here..."
        />
      </div>
    </div>
  )
}

function RecycleBinApp({ 
  root = FS_ROOT,
  onFileSystemUpdate,
  dragState,
  onDrop
}: { 
  root?: FSFolder
  onFileSystemUpdate?: () => void
  dragState?: DragState
  onDrop?: (item: DragItem) => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  
  const recycleBin = root.children['Recycle Bin']
  const items = recycleBin && recycleBin.type === 'folder' ? Object.entries(recycleBin.children) : []
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    if (dragState?.item && onDrop) {
      onDrop(dragState.item)
    }
  }
  
  const handleRestore = (recycledName: string) => {
    if (restoreFromRecycleBin(root, recycledName)) {
      onFileSystemUpdate?.()
    }
  }
  
  const handleEmpty = () => {
    if (confirm('Are you sure you want to empty the Recycle Bin? This action cannot be undone.')) {
      if (emptyRecycleBin(root)) {
        onFileSystemUpdate?.()
      }
    }
  }
  
  return (
    <div className="w-full h-full flex flex-col">
      {/* Toolbar */}
      <Windows95Raised className="px-2 py-1 mb-1">
        <div className="flex items-center justify-between">
          <div className="text-xs">File Edit View Help</div>
          <div className="flex gap-1">
            <button
              onClick={handleEmpty}
              disabled={items.length === 0}
              className="px-2 py-0.5 text-xs bg-[#c0c0c0] border border-t-white border-l-white border-r-[#404040] border-b-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-r-white active:border-b-white disabled:opacity-50"
            >
              Empty Recycle Bin
            </button>
          </div>
        </div>
      </Windows95Raised>
      
      {/* Content area */}
      <div 
        className={cn(
          "flex-1 p-3 bg-[#dcdcdc] overflow-auto",
          isDragOver && "bg-blue-200 border-2 border-dashed border-blue-400"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {items.length === 0 ? (
          <div className="text-sm text-gray-600">The Recycle Bin is empty.</div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm font-semibold mb-2">Recycled Items ({items.length})</div>
            {items.map(([recycledName, item]) => {
              const recycledItem = item as RecycledNode
              const displayName = recycledItem.originalName || recycledName
              const isFolder = recycledItem.type === 'folder'
              
              return (
                <div 
                  key={recycledName}
                  className="flex items-center justify-between p-2 bg-white border border-gray-300 rounded"
                >
                  <div className="flex items-center gap-2">
                    <Image
                      src={isFolder ? '/icons/closed_folder.webp' : getFileIcon(displayName)}
                      alt={displayName}
                      width={16}
                      height={16}
                      className="w-4 h-4 object-contain"
                      draggable={false}
                    />
                    <span className="text-sm">{displayName}</span>
                    <span className="text-xs text-gray-500">
                      (from {recycledItem.originalPath?.join('\\') || 'Desktop'})
                    </span>
                  </div>
                  <button
                    onClick={() => handleRestore(recycledName)}
                    className="px-2 py-1 text-xs bg-[#c0c0c0] border border-t-white border-l-white border-r-[#404040] border-b-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-r-white active:border-b-white"
                  >
                    Restore
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function AboutApp() {
  return (
    <div className="w-full h-full p-4 text-sm bg-[#dcdcdc]">
      <div className="mb-3">
        <div className="font-bold">Windows 95 Desktop (Replica)</div>
        <div>Built with Next.js App Router, Tailwind CSS, and lucide-react icons.</div>
      </div>
      
      {/* EDITABLE CONTENT SECTION - Replace this paragraph with your own text */}
      <Windows95Raised className="p-3 mb-3">
        <div className="font-semibold mb-2">About This Project</div>
        <p className="text-sm leading-relaxed">
          Hi, my name is Liam. I&apos;m a Computer Science and Business student at Trinity College Dublin. I built this as a fun project to learn more about web development and design, and to showcase the projects I&apos;ve worked on.

          Last updated: 17/08/2025, 21:31:40
        </p>
      </Windows95Raised>
      
      <Windows95Raised className="p-3">
        <div className="font-semibold mb-2">Features</div>
        <ul className="list-disc pl-5 text-sm">
          <li>Drag windows by the title bar</li>
          <li>Minimize/restore via titlebar or taskbar</li>
          <li>Double-click desktop icons to open apps</li>
          <li>Browse folders in File Explorer</li>
          <li>Drag and drop items to Recycle Bin</li>
          <li>Create and edit text files in Notepad</li>
        </ul>
      </Windows95Raised>
    </div>
  )
}

function ImageViewerApp({ 
  filePath = '/files/Pictures/Image of Liam.jpg',
  currentFile = 'Image of Liam.jpg'
}: { 
  filePath?: string
  currentFile?: string
}) {
  return (
    <div className="w-full h-full flex flex-col">
      {/* Toolbar */}
      <Windows95Raised className="px-2 py-1 mb-1">
        <div className="flex items-center justify-between">
          <div className="text-xs">File Edit View Help</div>
          <div className="flex gap-1">
            <button
              className="px-2 py-0.5 text-xs bg-[#c0c0c0] border border-t-white border-l-white border-r-[#404040] border-b-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-r-white active:border-b-white"
              onClick={() => window.open(filePath, '_blank')}
            >
              Open in New Tab
            </button>
          </div>
        </div>
      </Windows95Raised>
      
      {/* Image display area */}
      <div className="flex-1 bg-white p-2 overflow-auto">
        <div className="w-full h-full flex items-center justify-center">
          <Image
            src={filePath}
            alt={currentFile}
            width={800}
            height={600}
            className="max-w-full max-h-full object-contain"
            draggable={false}
          />
        </div>
      </div>
    </div>
  )
}

function PDFViewerApp({ 
  filePath = '/files/Documents/CV.pdf',
  currentFile = 'CV/Resume.pdf'
}: { 
  filePath?: string
  currentFile?: string
}) {
  return (
    <div className="w-full h-full flex flex-col">
      {/* Toolbar */}
      <Windows95Raised className="px-2 py-1 mb-1">
        <div className="flex items-center justify-between">
          <div className="text-xs">File Edit View Help</div>
          <div className="flex gap-1">
            <button
              className="px-2 py-0.5 text-xs bg-[#c0c0c0] border border-t-white border-l-white border-r-[#404040] border-b-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-r-white active:border-b-white"
              onClick={() => window.open(filePath, '_blank')}
            >
              Open in New Tab
            </button>
          </div>
        </div>
      </Windows95Raised>
      
      {/* PDF display area */}
      <div className="flex-1 bg-white p-2 overflow-auto">
        <div className="w-full h-full">
          <iframe
            src={filePath}
            className="w-full h-full border-none"
            title={currentFile}
          />
        </div>
      </div>
    </div>
  )
}

// File Explorer App
type ExplorerProps = {
  initialPath?: string[]
  root?: FSFolder
  onOpenApp?: (type: WindowType, payload?: WindowPayload) => void
  refreshTrigger?: number
  onStartDrag?: (item: DragItem, position: Vec2) => void
  onDragMove?: (position: Vec2) => void
  onEndDrag?: () => void
}

function FileExplorerApp({ initialPath = [], root = FS_ROOT, onOpenApp, refreshTrigger, onStartDrag }: ExplorerProps) {
  // path: [] => "My Computer" (virtual root)
  const [path, setPath] = useState<string[]>([])
  const [manuallyExpandedFolders, setManuallyExpandedFolders] = useState<Set<string>>(new Set())
  const [manuallyCollapsedFolders, setManuallyCollapsedFolders] = useState<Set<string>>(new Set())
  
  // Only set initial path once on mount
  useEffect(() => {
    if (initialPath.length > 0) {
      setPath(initialPath)
    }
  }, [initialPath]) // Include initialPath in dependencies
  
  // Force refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger) {
      // Trigger re-render by updating path
      setPath(prev => [...prev])
    }
  }, [refreshTrigger])
  const currentNode = useMemo(() => {
    const node = path.length === 0 ? root : getNodeByPath(root, path)
    console.log('Current node calculated:', { path, nodeType: node?.type, hasChildren: node?.type === 'folder' ? Object.keys(node.children).length : 0 })
    return node
  }, [path, root])

  const canGoUp = path.length > 0
  const goUp = () => setPath((p) => p.slice(0, -1))

  const goBack = () => {
    // For demo, back = up
    if (canGoUp) goUp()
  }

  const openItem = (name: string) => {
    console.log('Opening item:', name, 'Current path:', path)
    
    if (path.length === 0) {
      // At "My Computer" viewing drives: open drive
      console.log('Opening drive:', name)
      setPath([name])
      return
    }
    
    const node = getNodeByPath(root, path)
    if (!node || node.type !== 'folder') {
      console.log('Invalid node or not a folder')
      return
    }
    
    const target = node.children[name]
    if (!target) {
      console.log('Target not found:', name)
      return
    }
    
    if (target.type === 'folder') {
      console.log('Opening folder:', name)
      setPath((p) => [...p, name])
    } else {
      // File: Handle different file types
      console.log('Opening file:', name)
      
      // Handle desktop icon shortcuts (.lnk files)
      if (name.endsWith('.lnk')) {
        const iconName = name.replace('.lnk', '')
        switch (iconName) {
          case 'My Computer':
            onOpenApp?.('file-explorer', { initialPath: [] })
            break
          case 'Documents':
            onOpenApp?.('file-explorer', { initialPath: ['C:', 'Documents'] })
            break
          case 'Notepad':
            onOpenApp?.('notepad')
            break
          case 'Recycle Bin':
            onOpenApp?.('recycle-bin')
            break
          case 'About':
            onOpenApp?.('about')
            break
          default:
            alert(`Opening shortcut: ${name}`)
        }
      } else {
        // Handle different file types
        if (name.endsWith('.txt')) {
          // Open .txt files in Notepad with their content
          const fileContent = target.content || ''
          onOpenApp?.('notepad', { text: fileContent, currentFile: name })
        } else if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png')) {
          // Open image files in image viewer
          const filePath = `/files/Pictures/${name}`
          onOpenApp?.('image-viewer', { filePath, fileType: 'image', currentFile: name })
        } else if (name.endsWith('.pdf')) {
          // Open PDF files in PDF viewer
          // Handle nested folder structure for CV/Resume.pdf
          const filePath = name === 'CV/Resume.pdf' ? `/files/Documents/CV.pdf` : `/files/Documents/${name}`
          onOpenApp?.('pdf-viewer', { filePath, fileType: 'pdf', currentFile: name })
        } else {
          alert(`Opening file: ${name}`)
        }
      }
    }
  }

  // Tree folder handlers
  const handlePathChange = (newPath: string[]) => {
    console.log('🔄 handlePathChange called with:', newPath)
    setPath(newPath)
  }

  const handleForceUpdate = () => {
    console.log('🔄 handleForceUpdate called')
    // Trigger re-render by updating path
    setPath(prev => [...prev])
  }

  const handleToggleExpanded = (folderKey: string, isOpen: boolean) => {
    console.log('🔄 handleToggleExpanded called:', { folderKey, isOpen })
    
    if (isOpen) {
      // Expanding: remove from collapsed set, add to expanded set
      setManuallyCollapsedFolders(prev => {
        const newSet = new Set(prev)
        newSet.delete(folderKey)
        console.log('➖ Removed folder from manually collapsed:', folderKey)
        return newSet
      })
      setManuallyExpandedFolders(prev => {
        const newSet = new Set(prev)
        newSet.add(folderKey)
        console.log('➕ Added folder to manually expanded:', folderKey)
        return newSet
      })
    } else {
      // Collapsing: remove from expanded set, add to collapsed set
      setManuallyExpandedFolders(prev => {
        const newSet = new Set(prev)
        newSet.delete(folderKey)
        console.log('➖ Removed folder from manually expanded:', folderKey)
        return newSet
      })
      setManuallyCollapsedFolders(prev => {
        const newSet = new Set(prev)
        newSet.add(folderKey)
        console.log('➕ Added folder to manually collapsed:', folderKey)
        return newSet
      })
    }
  }

  // Debug logging for state changes
  useEffect(() => {
    console.log('📊 Current path changed to:', path)
  }, [path])

  useEffect(() => {
    console.log('📊 Manually expanded folders changed to:', Array.from(manuallyExpandedFolders))
  }, [manuallyExpandedFolders])

  useEffect(() => {
    console.log('📊 Manually collapsed folders changed to:', Array.from(manuallyCollapsedFolders))
  }, [manuallyCollapsedFolders])

  const breadcrumb = useMemo(() => {
    if (path.length === 0) return ['My Computer']
    return ['My Computer', ...path]
  }, [path])

  // Debug path changes
  useEffect(() => {
    console.log('Path changed to:', path)
  }, [path])

  // Left tree (simple)
  function TreeFolder({
    label,
    node,
    fullPath,
    currentPath,
    onPathChange,
    onForceUpdate,
    manuallyExpandedSet,
    manuallyCollapsedSet,
    onToggleExpanded,
  }: {
    label: string
    node: FSNode
    fullPath: string[]
    currentPath: string[]
    onPathChange: (path: string[]) => void
    onForceUpdate: () => void
    manuallyExpandedSet: Set<string>
    manuallyCollapsedSet: Set<string>
    onToggleExpanded: (folderKey: string, isOpen: boolean) => void
  }) {
    const folderKey = fullPath.join('/')
    
    // Check if manually expanded or collapsed
    const isManuallyExpanded = manuallyExpandedSet.has(folderKey)
    const isManuallyCollapsed = manuallyCollapsedSet.has(folderKey)
    
    // Auto-expand if this folder is in the current path or is a parent of the current path
    const shouldBeOpen = fullPath.length <= 1 || currentPath.some((_, index) => 
      currentPath.slice(0, index + 1).join('/') === fullPath.join('/')
    )
    
    // Determine if folder should be open
    // Manual collapse takes precedence over auto-expansion
    // Manual expansion takes precedence over auto-collapse
    const isOpen = isManuallyExpanded || (shouldBeOpen && !isManuallyCollapsed)
    
    // Auto-add to manually expanded set if it's part of the current path and not manually collapsed
    useEffect(() => {
      if (shouldBeOpen && !isManuallyExpanded && !isManuallyCollapsed) {
        console.log('🔄 Auto-adding to manually expanded:', folderKey)
        onToggleExpanded(folderKey, true)
      }
    }, [shouldBeOpen, isManuallyExpanded, isManuallyCollapsed, folderKey, onToggleExpanded])
    
    const isActive = fullPath.join('/') === currentPath.join('/')

    if (node.type !== 'folder') return null
    const entries = Object.entries(node.children)

    console.log('🌳 TreeFolder render:', {
      label,
      folderKey,
      fullPath,
      currentPath,
      shouldBeOpen,
      isManuallyExpanded,
      isManuallyCollapsed,
      isOpen,
      isActive,
      manuallyExpandedSetSize: manuallyExpandedSet.size,
      manuallyCollapsedSetSize: manuallyCollapsedSet.size
    })

      return (
    <div className="select-none">
      <div
        className={cn(
          'w-full text-left px-1 py-0.5 text-xs rounded hover:bg-[#bdbdbd] flex items-center gap-1 select-none',
          isActive && 'bg-[#9c9c9c]'
        )}
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          console.log('Tree item mouse down:', label, 'Path:', fullPath)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            console.log('Tree item keyboard activated:', label, 'Path:', fullPath)
            onPathChange(fullPath)
            onForceUpdate()
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Folder ${label}`}
      >
        <button
          className="flex items-center justify-center w-3 h-3 hover:bg-[#9c9c9c] rounded"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            console.log('🖱️ Arrow clicked for:', { label, folderKey, currentIsOpen: isOpen })
            const newOpenState = !isOpen
            console.log('🔄 Setting new open state:', newOpenState)
            onToggleExpanded(folderKey, newOpenState)
          }}
          aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${label}`}
        >
          <ChevronRight
            className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-90')}
          />
        </button>
        <button
          className="flex items-center gap-1 flex-1 cursor-pointer"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            console.log('Tree item clicked:', label, 'Path:', fullPath, 'Current path before:', currentPath)
            
            // If this folder is currently manually expanded, keep it expanded
            if (isManuallyExpanded) {
              console.log('🔄 Keeping folder manually expanded:', folderKey)
            }
            
            onPathChange(fullPath)
            onForceUpdate()
            console.log('setPath called with:', fullPath)
          }}
          aria-label={`Navigate to ${label}`}
        >
          <Image
            src="/icons/closed_folder.webp"
            alt={label}
            width={14}
            height={14}
            className="w-3.5 h-3.5 object-contain"
            draggable={false}
          />
          <span className="truncate">{label}</span>
        </button>
      </div>
        {isOpen && (
          <div className="pl-4">
            {entries.map(([name, child]) => {
              if (child.type === 'folder') {
                return (
                  <TreeFolder 
                    key={name} 
                    label={name} 
                    node={child} 
                    fullPath={[...fullPath, name]}
                    currentPath={currentPath}
                    onPathChange={onPathChange}
                    onForceUpdate={onForceUpdate}
                    manuallyExpandedSet={manuallyExpandedSet}
                    manuallyCollapsedSet={manuallyCollapsedSet}
                    onToggleExpanded={onToggleExpanded}
                  />
                )
              } else {
                // Show files in the tree view
                return (
                  <div
                    key={name}
                    className="w-full text-left px-1 py-0.5 text-xs rounded hover:bg-[#bdbdbd] flex items-center gap-1 cursor-pointer select-none"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      openItem(name)
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`File ${name}`}
                  >
                    <div className="w-3 h-3" /> {/* Spacer for alignment */}
                    <Image
                      src={getFileIcon(name)}
                      alt={name}
                      width={14}
                      height={14}
                      className="w-3.5 h-3.5 object-contain"
                      draggable={false}
                    />
                    <span className="truncate">{name.endsWith('.lnk') ? name.replace('.lnk', '') : name}</span>
                  </div>
                )
              }
            })}
          </div>
        )}
      </div>
    )
  }

  const rightPaneItems = useMemo(() => {
    if (!currentNode || currentNode.type !== 'folder') {
      return []
    }
    const items = Object.entries(currentNode.children).map(([name, node]) => ({
      name,
      type: node.type === 'folder' ? 'folder' : 'file',
      node,
    }))
    console.log('Showing items:', items)
    return items
  }, [currentNode])

  return (
    <div className="w-full h-full flex flex-col">
      {/* Toolbar */}
      <Windows95Raised className="px-1 py-1">
        <div className="flex items-center gap-1">
          <button
            className="px-2 py-0.5 text-xs bg-[#c0c0c0] border border-t-white border-l-white border-r-[#404040] border-b-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-r-white active:border-b-white disabled:opacity-50"
            onClick={goBack}
            disabled={!canGoUp}
            aria-label="Back"
            title="Back"
          >
            <ChevronLeft className="w-4 h-4 inline-block" />
          </button>
          <button
            className="px-2 py-0.5 text-xs bg-[#c0c0c0] border border-t-white border-l-white border-r-[#404040] border-b-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-r-white active:border-b-white disabled:opacity-50"
            onClick={goUp}
            disabled={!canGoUp}
            aria-label="Up"
            title="Up"
          >
            <ChevronUp className="w-4 h-4 inline-block" />
          </button>
          <button
            className="px-2 py-0.5 text-xs bg-[#c0c0c0] border border-t-white border-l-white border-r-[#404040] border-b-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-r-white active:border-b-white"
            onClick={() => {
              // For demo, no-op
            }}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCcw className="w-4 h-4 inline-block" />
          </button>
          <Windows95Inset className="ml-2 px-2 py-0.5 text-xs flex-1 overflow-hidden">
            <div className="truncate flex items-center gap-1">
              {breadcrumb.map((item, index) => {
                const itemPath = index === 0 ? [] : breadcrumb.slice(1, index + 1)
                return (
                  <span key={index}>
                    {index > 0 && <span className="mx-1">\</span>}
                    <button
                      className={cn(
                        'hover:underline',
                        index === breadcrumb.length - 1 && 'font-semibold'
                      )}
                      onClick={() => {
                        if (index === 0) {
                          setPath([]) // My Computer
                        } else {
                          setPath(itemPath)
                        }
                      }}
                    >
                      {item}
                    </button>
                  </span>
                )
              })}
            </div>
          </Windows95Inset>
        </div>
      </Windows95Raised>

      {/* Body */}
      <div className="flex-1 grid grid-cols-[220px_1fr] gap-1 p-1 overflow-hidden">
        <Windows95Raised className="h-full overflow-auto">
          <div className="p-1">
            {/* Virtual "My Computer" root */}
            <button
              className={cn(
                'w-full text-left px-1 py-0.5 text-xs rounded hover:bg-[#bdbdbd] flex items-center gap-1',
                path.length === 0 && 'bg-[#9c9c9c]'
              )}
              onClick={() => {
                console.log('My Computer clicked')
                setPath([])
              }}
              aria-label="My Computer"
            >
              <Image
                src="/icons/computer.webp"
                alt="My Computer"
                width={14}
                height={14}
                className="w-3.5 h-3.5 object-contain"
                draggable={false}
              />
              <span>My Computer</span>
            </button>
            {/* Drives */}
            <div className="pl-4 mt-1">
              {Object.entries(root.children).map(([drive, node]) => (
                <TreeFolder 
                  key={drive} 
                  label={drive} 
                  node={node} 
                  fullPath={[drive]}
                  currentPath={path}
                  onPathChange={handlePathChange}
                  onForceUpdate={handleForceUpdate}
                  manuallyExpandedSet={manuallyExpandedFolders}
                  manuallyCollapsedSet={manuallyCollapsedFolders}
                  onToggleExpanded={handleToggleExpanded}
                />
              ))}
            </div>
          </div>
        </Windows95Raised>
        <Windows95Raised className="h-full overflow-auto">
          <div className="p-2 h-full">
            <div className="h-full w-fit flex flex-col flex-wrap content-start items-start gap-y-2 gap-x-4">
              {rightPaneItems.map((item) => {
                const isFolder = item.type === 'folder' || item.type === 'drive'
                const iconSrc = isFolder ? '/icons/closed_folder.webp' : getFileIcon(item.name)
                
                return (
                  <button
                    key={item.name}
                    className="w-28 h-20 flex flex-col items-center justify-center gap-1 rounded hover:bg-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-grab active:cursor-grabbing"
                    onDoubleClick={() => {
                      console.log('Double-clicked:', item.name)
                      openItem(item.name)
                    }}
                    onClick={() => {
                      console.log('Single-clicked:', item.name)
                      // For single click, we could add selection highlighting
                    }}
                    onMouseDown={(e) => {
                      if (!onStartDrag) return
                      
                      const dragStart = { x: e.clientX, y: e.clientY }
                      
                      const handleMouseMove = (e: MouseEvent) => {
                        const deltaX = Math.abs(e.clientX - dragStart.x)
                        const deltaY = Math.abs(e.clientY - dragStart.y)
                        
                        // Start drag if moved more than 5 pixels
                        if (deltaX > 5 || deltaY > 5) {
                          const dragItem: DragItem = {
                            type: 'file-explorer-item',
                            name: item.name,
                            path: path,
                            isFolder: item.type === 'folder',
                            originalLocation: path
                          }
                          onStartDrag(dragItem, { x: e.clientX, y: e.clientY })
                          document.removeEventListener('mousemove', handleMouseMove)
                          document.removeEventListener('mouseup', handleMouseUp)
                        }
                      }
                      
                      const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove)
                        document.removeEventListener('mouseup', handleMouseUp)
                      }
                      
                      document.addEventListener('mousemove', handleMouseMove)
                      document.addEventListener('mouseup', handleMouseUp)
                    }}
                    aria-label={`Open ${item.name}`}
                    title={item.name}
                  >
                    <Image
                      src={iconSrc}
                      alt={item.name}
                      width={32}
                      height={32}
                      className="w-8 h-8 object-contain"
                      draggable={false}
                    />
                    <span className="text-xs text-black text-center truncate w-full leading-tight">
                      {item.name.endsWith('.lnk') ? item.name.replace('.lnk', '') : item.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </Windows95Raised>
      </div>
    </div>
  )
}

export default function Page() {
  const { next } = useZIndexManager()
  const [windows, setWindows] = useState<WinInstance[]>([])
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null)
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false)
  const [desktopUpdateTrigger, setDesktopUpdateTrigger] = useState(0)
  const [fileSystem, setFileSystem] = useState<FSFolder>(DEFAULT_FS_ROOT)
  const [isClient, setIsClient] = useState(false)
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    item: null,
    position: { x: 0, y: 0 }
  })
  const viewport = useViewportSize()

  // Track if we've already initialized
  const initializedRef = useRef(false)

  // Load file system from localStorage only on client side
  useEffect(() => {
    if (initializedRef.current) return
    
    setIsClient(true)
    const savedFS = loadFileSystem()
    setFileSystem(savedFS)
    
    // Open About window by default
    const aboutId = `about-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const aboutWindow: WinInstance = {
      id: aboutId,
      title: 'About Windows',
      type: 'about',
      minimized: false,
      z: next(),
      position: { x: 580, y: 180 }, // Positioned to the right of desktop icons
      size: { w: 720, h: 720 }, // Twice as large as default
    }
    setWindows([aboutWindow])
    
    initializedRef.current = true
  }, [next])

  // Global mouse event handlers for drag
  useEffect(() => {
    if (!dragState.isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove({ x: e.clientX, y: e.clientY })
    }

    const handleMouseUp = () => {
      handleEndDrag()
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState.isDragging])

  const bringToFront = (id: string) => {
    const zTop = next()
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, z: zTop } : w)))
  }

  const toggleMinimize = (id: string) => {
    setWindows((ws) =>
      ws.map((w) => (w.id === id ? { ...w, minimized: !w.minimized } : w))
    )
  }

  const closeWindow = (id: string) => {
    setWindows((ws) => ws.filter((w) => w.id !== id))
  }

  const moveWindow = (id: string, pos: Vec2) => {
    // keep in viewport
    const padding = 24
    const maxX = Math.max(0, (viewport.w || 0) - 320 - padding)
    const maxY = Math.max(0, (viewport.h || 0) - 200 - 48)
    setWindows((ws) =>
      ws.map((w) =>
        w.id === id
          ? {
              ...w,
              position: {
                x: Math.min(Math.max(0, pos.x), maxX),
                y: Math.min(Math.max(0, pos.y), maxY),
              },
            }
          : w
      )
    )
  }

  const triggerDesktopUpdate = () => {
    setDesktopUpdateTrigger(prev => prev + 1)
  }

  // Drag and drop handlers
  const handleStartDrag = (item: DragItem, position: Vec2) => {
    setDragState({
      isDragging: true,
      item,
      position
    })
  }

  const handleDragMove = (position: Vec2) => {
    setDragState(prev => ({
      ...prev,
      position
    }))
  }

  const handleEndDrag = () => {
    setDragState({
      isDragging: false,
      item: null,
      position: { x: 0, y: 0 }
    })
  }

  const handleDropToRecycleBin = (item: DragItem) => {
    console.log('Dropping item to recycle bin:', item)
    const success = moveToRecycleBin(fileSystem, item.originalLocation, item.name)
    if (success) {
      setFileSystem({ ...fileSystem })
      triggerDesktopUpdate()
      alert(`"${item.name}" has been moved to the Recycle Bin.`)
    } else {
      alert('Failed to move item to Recycle Bin.')
    }
    handleEndDrag()
  }

  // Wrapper functions that update both state and localStorage
  const createFilePersistent = (path: string[], filename: string, content: string): boolean => {
    const success = createFile(fileSystem, path, filename, content)
    if (success) {
      setFileSystem({ ...fileSystem })
    }
    return success
  }

  const updateFilePersistent = (path: string[], filename: string, content: string): boolean => {
    const success = updateFile(fileSystem, path, filename, content)
    if (success) {
      setFileSystem({ ...fileSystem })
    }
    return success
  }

  const openApp = useCallback((type: WindowType, payload?: WindowPayload) => {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const base: WinInstance = {
      id,
      title:
        type === 'file-explorer'
          ? 'File Explorer'
          : type === 'notepad'
          ? 'Notepad'
          : type === 'recycle-bin'
          ? 'Recycle Bin'
          : type === 'image-viewer'
          ? `Image Viewer - ${payload?.currentFile || 'Image'}`
          : type === 'pdf-viewer'
          ? `PDF Viewer - ${payload?.currentFile || 'PDF'}`
          : 'About',
      type,
      minimized: false,
      z: next(),
      position: randPosition(windows.length * 12),
      size: type === 'file-explorer' ? { w: 760, h: 520 } : 
            type === 'about' ? { w: 720, h: 720 } : 
            type === 'image-viewer' ? { w: 800, h: 600 } :
            type === 'pdf-viewer' ? { w: 800, h: 600 } :
            { w: 520, h: 360 },
      payload,
    }
    setWindows((ws) => [...ws, base])
  }, [next, windows.length])

  const handleStartClick = () => {
    setIsStartMenuOpen(!isStartMenuOpen)
  }

  const closeStartMenu = () => {
    setIsStartMenuOpen(false)
  }

  const renderContent = (w: WinInstance) => {
    switch (w.type) {
      case 'file-explorer':
        return <FileExplorerApp 
          initialPath={(w.payload?.initialPath as string[]) || []} 
          root={fileSystem}
          onOpenApp={openApp}
          refreshTrigger={desktopUpdateTrigger}
          onStartDrag={handleStartDrag}
          onDragMove={handleDragMove}
          onEndDrag={handleEndDrag}
        />
      case 'notepad':
        return <NotepadApp 
          text={w.payload?.text || 'Hello from Notepad.\n\nThis is a demo.'} 
          onDesktopUpdate={triggerDesktopUpdate}
          onCreateFile={createFilePersistent}
          onUpdateFile={updateFilePersistent}
          initialCurrentFile={w.payload?.currentFile}
        />
      case 'recycle-bin':
        return <RecycleBinApp 
          root={fileSystem}
          onFileSystemUpdate={() => {
            setFileSystem({ ...fileSystem })
            triggerDesktopUpdate()
          }}
          dragState={dragState}
          onDrop={handleDropToRecycleBin}
        />
      case 'about':
        return <AboutApp />
      case 'image-viewer':
        return <ImageViewerApp 
          filePath={w.payload?.filePath}
          currentFile={w.payload?.currentFile}
        />
      case 'pdf-viewer':
        return <PDFViewerApp 
          filePath={w.payload?.filePath}
          currentFile={w.payload?.currentFile}
        />
      default:
        return null
    }
  }



  // Get all desktop icons from the file system
  const desktopIcons = useMemo(() => {
    if (!isClient) return []
    
    const icons: Array<{
      key: string
      title: string
      icon?: React.ComponentType<{ className?: string }>
      imgSrc?: string
      onOpen: () => void
      draggable?: boolean
      dragItem?: DragItem
      iconKey?: string
    }> = [
      {
        key: 'my-computer',
        title: 'My Computer',
        imgSrc: '/icons/computer.webp',
        onOpen: () => openApp('file-explorer', { initialPath: [] }),
        draggable: false,
        iconKey: 'my-computer'
      },
      {
        key: 'documents',
        title: 'Documents',
        imgSrc: '/icons/closed_folder.webp',
        onOpen: () => openApp('file-explorer', { initialPath: ['C:', 'Documents'] }),
        draggable: false,
        iconKey: 'documents'
      },
      {
        key: 'notepad',
        title: 'Notepad',
        imgSrc: '/icons/notepad.webp',
        onOpen: () => openApp('notepad'),
        draggable: false,
        iconKey: 'notepad'
      },
      {
        key: 'recycle-bin',
        title: 'Recycle Bin',
        imgSrc: '/icons/dustbin.webp',
        onOpen: () => openApp('recycle-bin'),
        draggable: false,
        iconKey: 'recycle-bin'
      },
      {
        key: 'about',
        title: 'About',
        imgSrc: '/icons/help.webp',
        onOpen: () => openApp('about'),
        draggable: false,
        iconKey: 'about'
      }
    ]
    
    return icons
  }, [isClient, openApp]) // Only include necessary dependencies

  return (
    <main
      className="relative h-screen overflow-hidden"
      // Classic Win95 teal-ish desktop
      style={{ backgroundColor: '#008080' }}
      onClick={(e) => {
        // Deselect icons if clicking empty desktop
        if (e.currentTarget === e.target) setSelectedIcon(null)
      }}
    >
      {/* Desktop icons, vertical-first with column wrapping */}
      <div className="absolute inset-x-0 top-0 bottom-16 p-4 pointer-events-auto">
        <div className="h-full w-fit flex flex-col flex-wrap content-start items-start gap-y-4 gap-x-6">
          {desktopIcons.map((ic) => (
            <DesktopIcon
              key={ic.key}
              title={ic.title}
              icon={ic.icon}
              imgSrc={ic.imgSrc}
              onOpen={ic.onOpen}
              selected={selectedIcon === ic.key}
              onSelect={() => setSelectedIcon(ic.key)}
              draggable={ic.draggable}
              onStartDrag={ic.draggable ? handleStartDrag : undefined}
              dragItem={ic.dragItem}
              iconKey={ic.iconKey}
            />
          ))}
        </div>
      </div>

      {/* Global drag overlay */}
      {dragState.isDragging && dragState.item && (
        <div
          className="fixed pointer-events-none z-[20000] bg-blue-500/20 border-2 border-blue-500 rounded p-2 text-white text-sm"
          style={{
            left: dragState.position.x - 20,
            top: dragState.position.y - 20,
          }}
        >
          <div className="flex items-center gap-2">
            <Image
              src={dragState.item.isFolder ? '/icons/closed_folder.webp' : getFileIcon(dragState.item.name)}
              alt={dragState.item.name}
              width={16}
              height={16}
              className="w-4 h-4 object-contain"
              draggable={false}
            />
            <span>{dragState.item.name}</span>
          </div>
        </div>
      )}

      {/* Global drop detection for Recycle Bin icon */}
      {dragState.isDragging && (
        <div
          className="fixed inset-0 pointer-events-auto z-[15000]"
          onMouseMove={(e) => {
            // Check if mouse is over Recycle Bin icon area for visual feedback
            const recycleBinIcon = document.querySelector('[data-icon="recycle-bin"]')
            if (recycleBinIcon) {
              const rect = recycleBinIcon.getBoundingClientRect()
              const isOverRecycleBin = (
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom
              )
              
              // Add visual feedback
              if (isOverRecycleBin) {
                recycleBinIcon.classList.add('ring-4', 'ring-red-500', 'ring-opacity-50')
              } else {
                recycleBinIcon.classList.remove('ring-4', 'ring-red-500', 'ring-opacity-50')
              }
            }
          }}
          onMouseUp={(e) => {
            // Check if mouse is over Recycle Bin icon area
            const recycleBinIcon = document.querySelector('[data-icon="recycle-bin"]')
            if (recycleBinIcon) {
              const rect = recycleBinIcon.getBoundingClientRect()
              if (
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom
              ) {
                if (dragState.item) {
                  handleDropToRecycleBin(dragState.item)
                }
              }
              // Remove visual feedback
              recycleBinIcon.classList.remove('ring-4', 'ring-red-500', 'ring-opacity-50')
            }
            // Always end drag
            handleEndDrag()
          }}
        />
      )}

      {/* Windows */}
      {windows.map((w) => (
        <Window95
          key={w.id}
          id={w.id}
          title={w.title}
          position={w.position}
          z={w.z}
          minimized={w.minimized}
          onMouseDown={bringToFront}
          onClose={closeWindow}
          onMinimize={toggleMinimize}
          onDragMove={moveWindow}
          initialSize={w.size}
        >
          {renderContent(w)}
        </Window95>
      ))}

      {/* Start Menu */}
      <StartMenu
        isOpen={isStartMenuOpen}
        onClose={closeStartMenu}
        onOpenApp={openApp}
      />

      {/* Taskbar */}
      <Taskbar
        windows={windows}
        onToggleMinimize={(id) => toggleMinimize(id)}
        onFocus={(id) => bringToFront(id)}
        onStartClick={handleStartClick}
        isStartMenuOpen={isStartMenuOpen}
      />
    </main>
  )
}

// Helper function to get the correct icon for a file based on its extension
function getFileIcon(filename: string): string {
  const extension = filename.toLowerCase().split('.').pop()
  
  switch (extension) {
    case 'txt':
      return '/icons/txt_file.webp'
    case 'pdf':
      return '/icons/pdf_file.webp'
    case 'jpg':
    case 'jpeg':
      return '/icons/image_file.webp'
    case 'png':
      return '/icons/image_file.webp'
    case 'lnk':
      // Handle shortcuts
      const iconName = filename.replace('.lnk', '')
      switch (iconName) {
        case 'My Computer': return '/icons/computer.webp'
        case 'Documents': return '/icons/closed_folder.webp'
        case 'Notepad': return '/icons/notepad.webp'
        case 'Recycle Bin': return '/icons/dustbin.webp'
        case 'About': return '/icons/help.webp'
        default: return '/icons/pdf_file.webp'
      }
    default:
      return '/icons/pdf_file.webp'
  }
}
