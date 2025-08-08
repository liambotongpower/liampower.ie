'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Folder, HardDrive, FileText, Trash2, StickyNote, Minus, X, Monitor, ChevronLeft, ChevronUp, Home, RefreshCcw, Clock, ChevronRight, Settings, HelpCircle, Power } from 'lucide-react'
import { cn } from '@/lib/utils'

type Vec2 = { x: number; y: number }

type WindowType = 'file-explorer' | 'notepad' | 'recycle-bin' | 'about'

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
type FSFile = { type: 'file'; ext: string; size: number }
type FSFolder = { type: 'folder'; children: Record<string, FSNode> }
type FSNode = FSFile | FSFolder

const FS_ROOT: FSFolder = {
  type: 'folder',
  children: {
    'C:': {
      type: 'folder',
      children: {
        Documents: {
          type: 'folder',
          children: {
            'Resume.txt': { type: 'file', ext: 'txt', size: 12_345 },
            'Ideas.txt': { type: 'file', ext: 'txt', size: 3_210 },
          },
        },
        Pictures: {
          type: 'folder',
          children: {
            'Photo1.jpg': { type: 'file', ext: 'jpg', size: 845_120 },
            'Logo.png': { type: 'file', ext: 'png', size: 120_432 },
          },
        },
        Windows: { type: 'folder', children: {} },
        'autoexec.bat': { type: 'file', ext: 'bat', size: 512 },
      },
    },
    'D:': {
      type: 'folder',
      children: {
        'Setup.exe': { type: 'file', ext: 'exe', size: 2_412_000 },
      },
    },
  },
}

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
}: {
  title?: string
  onOpen?: () => void
  icon?: React.ComponentType<{ className?: string }>
  imgSrc?: string
  imgAlt?: string
  selected?: boolean
  onSelect?: () => void
  className?: string
}) {
  const lastClickRef = useRef(0)
  const handleClick = () => {
    const now = Date.now()
    if (now - lastClickRef.current < 300) {
      onOpen()
    } else {
      onSelect()
    }
    lastClickRef.current = now
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex flex-col items-center justify-start gap-1 p-2 rounded outline-none focus:ring-2 focus:ring-emerald-400 w-20 h-24',
        { 'bg-black/20': selected },
        className
      )}
      aria-label={title}
      title={title}
    >
      {imgSrc ? (
        <Image
          src={imgSrc || '/placeholder.svg?height=40&width=40'}
          alt={imgAlt || title}
          width={40}
          height={40}
          className="w-10 h-10 object-contain"
          draggable={false}
        />
      ) : (
        <Icon className="w-10 h-10 text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]" />
      )}
      <span className="text-xs text-white text-center leading-tight drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]">
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
    <div className="fixed bottom-0 left-0 right-0 h-10" style={{ zIndex: 9999 }}>
      <Windows95Raised className="h-full w-full px-2 flex items-center gap-2">
        <button
          onClick={onStartClick}
          className={cn(
            "px-3 py-1 text-sm bg-[#c0c0c0] border border-t-white border-l-white border-r-[#404040] border-b-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-r-white active:border-b-white flex items-center gap-2",
            isStartMenuOpen && "border-t-[#404040] border-l-[#404040] border-r-white border-b-white"
          )}
          aria-label="Start"
        >
          <Home className="w-4 h-4" />
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
                'px-3 py-1 text-sm whitespace-nowrap bg-[#c0c0c0] border border-t-white border-l-white border-r-[#404040] border-b-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-r-white active:border-b-white',
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
        <Windows95Inset className="px-2 py-1 flex items-center gap-1 min-w-[72px] justify-end">
          <Clock className="w-4 h-4" aria-hidden />
          <span className="text-sm tabular-nums">{time}</span>
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

function NotepadApp({ text = 'Welcome to Windows 95 Notepad (demo).' }: { text?: string }) {
  return (
    <div className="w-full h-full flex flex-col">
      <Windows95Raised className="px-2 py-1 mb-1">
        <div className="text-xs">File Edit View Help</div>
      </Windows95Raised>
      <div className="flex-1 bg-white p-2 font-mono text-sm overflow-auto">{text}</div>
    </div>
  )
}

function RecycleBinApp() {
  return (
    <div className="w-full h-full p-3 bg-[#dcdcdc]">
      <div className="text-sm">The Recycle Bin is empty.</div>
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
      <Windows95Raised className="p-3">
        <ul className="list-disc pl-5">
          <li>Drag windows by the title bar</li>
          <li>Minimize/restore via titlebar or taskbar</li>
          <li>Double-click desktop icons to open apps</li>
          <li>Browse folders in File Explorer</li>
        </ul>
      </Windows95Raised>
    </div>
  )
}

// File Explorer App
type ExplorerProps = {
  initialPath?: string[]
  root?: FSFolder
}

function FileExplorerApp({ initialPath = [], root = FS_ROOT }: ExplorerProps) {
  // path: [] => "My Computer" (virtual root)
  const [path, setPath] = useState<string[]>(initialPath)
  const currentNode = useMemo(() => (path.length === 0 ? root : getNodeByPath(root, path)), [path, root])

  const canGoUp = path.length > 0
  const goUp = () => setPath((p) => p.slice(0, -1))

  const goBack = () => {
    // For demo, back = up
    if (canGoUp) goUp()
  }

  const openItem = (name: string) => {
    if (path.length === 0) {
      // At "My Computer" viewing drives: open drive
      setPath([name])
      return
    }
    const node = getNodeByPath(root, path)
    if (!node || node.type !== 'folder') return
    const target = node.children[name]
    if (!target) return
    if (target.type === 'folder') {
      setPath((p) => [...p, name])
    } else {
      // File: For demo, do nothing or alert
      alert(`Opening file: ${name}`)
    }
  }

  const breadcrumb = useMemo(() => {
    if (path.length === 0) return ['My Computer']
    return ['My Computer', ...path]
  }, [path])

  // Left tree (simple)
  function TreeFolder({
    label,
    node,
    fullPath,
  }: {
    label: string
    node: FSNode
    fullPath: string[]
  }) {
    const [open, setOpen] = useState(fullPath.length <= 1) // expand root levels by default
    const isActive =
      breadcrumb.length > 1 &&
      fullPath.join('/') === path.join('/')

    if (node.type !== 'folder') return null
    const entries = Object.entries(node.children)

    return (
      <div className="select-none">
        <button
          className={cn(
            'w-full text-left px-1 py-0.5 text-xs rounded hover:bg-[#bdbdbd] flex items-center gap-1',
            isActive && 'bg-[#9c9c9c]'
          )}
          onClick={() => {
            setPath(fullPath)
          }}
          onDoubleClick={() => setOpen((o) => !o)}
          aria-label={`Folder ${label}`}
        >
          <ChevronRight
            className={cn('w-3 h-3 transition-transform', open && 'rotate-90')}
          />
          <Folder className="w-3.5 h-3.5" />
          <span className="truncate">{label}</span>
        </button>
        {open && (
          <div className="pl-4">
            {entries.map(([name, child]) =>
              child.type === 'folder' ? (
                <TreeFolder key={name} label={name} node={child} fullPath={[...fullPath, name]} />
              ) : null
            )}
          </div>
        )}
      </div>
    )
  }

  const rightPaneItems = useMemo(() => {
    if (path.length === 0) {
      // Drives
      return Object.keys(root.children).map((drive) => ({
        name: drive,
        type: 'drive' as const,
      }))
    }
    if (!currentNode || currentNode.type !== 'folder') return []
    return Object.entries(currentNode.children).map(([name, node]) => ({
      name,
      type: node.type === 'folder' ? 'folder' : 'file',
      node,
    }))
  }, [currentNode, path, root])

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
            <div className="truncate">{breadcrumb.join(' \\ ')}</div>
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
              onClick={() => setPath([])}
              aria-label="My Computer"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>My Computer</span>
            </button>
            {/* Drives */}
            <div className="pl-4 mt-1">
              {Object.entries(root.children).map(([drive, node]) => (
                <TreeFolder key={drive} label={drive} node={node} fullPath={[drive]} />
              ))}
            </div>
          </div>
        </Windows95Raised>
        <Windows95Raised className="h-full overflow-auto">
          <div className="p-2 h-full">
            <div className="h-full w-fit flex flex-col flex-wrap content-start items-start gap-y-2 gap-x-4">
              {rightPaneItems.map((item) => {
                const isFolder = item.type === 'folder' || item.type === 'drive'
                const Icon = isFolder ? Folder : FileText
                return (
                  <button
                    key={item.name}
                    className="w-28 h-20 flex flex-col items-center justify-center gap-1 rounded hover:bg-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    onDoubleClick={() => openItem(item.name)}
                    aria-label={`Open ${item.name}`}
                    title={item.name}
                  >
                    <Icon className="w-8 h-8 text-black" />
                    <span className="text-xs text-black text-center truncate w-full leading-tight">
                      {item.name}
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
  const viewport = useViewportSize()

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

  const openApp = (type: WindowType, payload?: WindowPayload) => {
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
          : 'About Windows',
      type,
      minimized: false,
      z: next(),
      position: randPosition(windows.length * 12),
      size: type === 'file-explorer' ? { w: 760, h: 520 } : { w: 520, h: 360 },
      payload,
    }
    setWindows((ws) => [...ws, base])
  }

  const handleStartClick = () => {
    setIsStartMenuOpen(!isStartMenuOpen)
  }

  const closeStartMenu = () => {
    setIsStartMenuOpen(false)
  }

  const renderContent = (w: WinInstance) => {
    switch (w.type) {
      case 'file-explorer':
        return <FileExplorerApp initialPath={(w.payload?.initialPath as string[]) || []} />
      case 'notepad':
        return <NotepadApp text={w.payload?.text || 'Hello from Notepad.\n\nThis is a demo.'} />
      case 'recycle-bin':
        return <RecycleBinApp />
      case 'about':
        return <AboutApp />
      default:
        return null
    }
  }

  const desktopIcons = [
    {
      key: 'my-computer',
      title: 'My Computer',
      icon: HardDrive,
      imgSrc: '/placeholder.svg?height=40&width=40',
      onOpen: () => openApp('file-explorer', { initialPath: [] }),
    },
    {
      key: 'documents',
      title: 'Documents',
      icon: Folder,
      imgSrc: '/placeholder.svg?height=40&width=40',
      onOpen: () => openApp('file-explorer', { initialPath: ['C:', 'Documents'] }),
    },
    {
      key: 'notepad',
      title: 'Notepad',
      icon: StickyNote,
      imgSrc: '/placeholder.svg?height=40&width=40',
      onOpen: () => openApp('notepad'),
    },
    {
      key: 'recycle-bin',
      title: 'Recycle Bin',
      icon: Trash2,
      imgSrc: '/placeholder.svg?height=40&width=40',
      onOpen: () => openApp('recycle-bin'),
    },
    {
      key: 'about',
      title: 'About',
      icon: Monitor,
      imgSrc: '/placeholder.svg?height=40&width=40',
      onOpen: () => openApp('about'),
    },
  ]

  return (
    <main
      className="relative min-h-screen"
      // Classic Win95 teal-ish desktop
      style={{ backgroundColor: '#008080' }}
      onClick={(e) => {
        // Deselect icons if clicking empty desktop
        if (e.currentTarget === e.target) setSelectedIcon(null)
      }}
    >
      {/* Desktop icons, vertical-first with column wrapping */}
      <div className="absolute inset-x-0 top-0 bottom-10 p-4 pointer-events-auto">
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
            />
          ))}
        </div>
      </div>

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
