import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HoverCard as HoverCard_, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Input, InputWithLabel } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Block, BlockContainer } from './block'

const AccordionDemo = () => {
  return (
    <Block title="Accordion">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger>Is it accessible?</AccordionTrigger>
          <AccordionContent>Yes. It adheres to the WAI-ARIA design pattern.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Is it accessible?</AccordionTrigger>
          <AccordionContent>Yes. It adheres to the WAI-ARIA design pattern.</AccordionContent>
        </AccordionItem>
      </Accordion>
    </Block>
  )
}

const AlertDialogDemo = () => {
  return (
    <Block title="Alert Dialog">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button>Open Alert Dialog</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account and remove your data from our
              servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Block>
  )
}

const AlertDemo = () => {
  return (
    <Block title="Alert">
      <Alert variant={'default'}>
        <AlertTitle>Default Alert</AlertTitle>
        <AlertDescription>You can add components and dependencies to your app using the cli.</AlertDescription>
      </Alert>
      <Alert variant={'destructive'}>
        <AlertTitle>Destructive Alert</AlertTitle>
        <AlertDescription>You can add components and dependencies to your app using the cli.</AlertDescription>
      </Alert>
      <Alert variant={'warning'}>
        <AlertTitle>Warning Alert</AlertTitle>
        <AlertDescription>You can add components and dependencies to your app using the cli.</AlertDescription>
      </Alert>
    </Block>
  )
}

const AvatarDemo = () => {
  return (
    <Block title="Avatar">
      <Avatar className="size-20">
        <AvatarImage src="/images/ray.png" />
        <AvatarFallback>CN</AvatarFallback>
      </Avatar>
    </Block>
  )
}

const BadgeDemo = () => {
  return (
    <Block title="Badge">
      <Badge variant={'default'}>Default Badge</Badge>
      <Badge variant={'destructive'}>Destructive Badge</Badge>
      <Badge variant={'secondary'}>Secondary Badge</Badge>
      <Badge variant={'outline'}>Outline Badge</Badge>
    </Block>
  )
}

const ButtonDemo = () => {
  return (
    <Block title="Button">
      <Button>Default Button</Button>
      <Button variant={'secondary'}>Secondary Button</Button>
      <Button variant={'destructive'}>Destructive Button</Button>
      <Button variant={'ghost'}>Ghost Button</Button>
      <Button variant={'link'}>Link Button</Button>
    </Block>
  )
}

const _CalendarDemo = () => {
  return <Block title="Calendar">TODO</Block>
}

const CardDemo = () => {
  const notifications = [
    {
      title: 'Your call has been confirmed.',
      description: '1 hour ago',
    },
    {
      title: 'You have a new message!',
      description: '1 hour ago',
    },
    {
      title: 'Your subscription is expiring soon!',
      description: '2 hours ago',
    },
  ]

  return (
    <Block title="Card">
      <Card className={'w-full max-w-[380px]'}>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>You have 3 unread messages.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className=" flex items-center space-x-4 rounded-md border p-4">
            <i className="i-lucide-bell" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium leading-none">Push Notifications</p>
              <p className="text-sm text-muted-foreground">Send notifications to device.</p>
            </div>
            <Switch />
          </div>
          <div>
            {notifications.map((notification, index) => (
              <div key={index} className="mb-4 grid grid-cols-[25px_1fr] items-start pb-4 last:mb-0 last:pb-0">
                <span className="flex h-2 w-2 translate-y-1 rounded-full bg-sky-500" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{notification.title}</p>
                  <p className="text-sm text-muted-foreground">{notification.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full">
            <i className="i-lucide-check mr-2 h-4 w-4" />
            Mark all as read
          </Button>
        </CardFooter>
      </Card>
    </Block>
  )
}

const CheckboxDemo = () => {
  return (
    <Block title="Checkbox">
      <div className="flex items-center space-x-2">
        <Checkbox id="check" />
        <Label htmlFor="check">Checkbox</Label>
      </div>
    </Block>
  )
}

const CollapsibleDemo = () => {
  return (
    <Block title="Collapsible">
      <Collapsible>
        <CollapsibleTrigger>Can I use this in my project?</CollapsibleTrigger>
        <CollapsibleContent>
          Yes. Free to use for personal and commercial projects. No attribution required.
        </CollapsibleContent>
      </Collapsible>
    </Block>
  )
}

const _ComboboxDemo = () => {
  return <Block title="Combobox">TOOD</Block>
}

const CommandDemo = () => {
  return (
    <Block title="Command">
      <Command>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem>Calendar</CommandItem>
            <CommandItem>Search Emoji</CommandItem>
            <CommandItem>Calculator</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem>Profile</CommandItem>
            <CommandItem>Billing</CommandItem>
            <CommandItem>Settings</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </Block>
  )
}

const ContextMenuDmeo = () => {
  return (
    <Block title="ContextMenu">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Button>Right Click</Button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Profile</ContextMenuItem>
          <ContextMenuItem>Billing</ContextMenuItem>
          <ContextMenuItem>Team</ContextMenuItem>
          <ContextMenuItem>Subscription</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </Block>
  )
}

const DialogDemo = () => {
  return (
    <Block title="Dialog">
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wath you want to do?</DialogTitle>
            <DialogDescription>I'm here to tell you that you can do anything you want to do.</DialogDescription>
          </DialogHeader>

          <div className="">
            <Input placeholder="Name" />
          </div>

          <DialogFooter>
            <DialogCancel>Cancel</DialogCancel>
            <Button>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Block>
  )
}

const DrawerDemo = () => {
  return (
    <Block title="Drawer">
      <Drawer shouldScaleBackground={false}>
        <DrawerTrigger asChild>
          <Button>Open</Button>
        </DrawerTrigger>
        <DrawerContent className="pb-10">
          <DrawerHeader>
            <DrawerTitle>Are you absolutely sure?</DrawerTitle>
            <DrawerDescription>This action cannot be undone.</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button>Submit</Button>
            <DrawerClose>
              <Button variant="ghost">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </Block>
  )
}

const DropdownMenuDemo = () => {
  return (
    <Block title="DropdownMenu">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Open</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem>Billing</DropdownMenuItem>
          <DropdownMenuItem>Team</DropdownMenuItem>
          <DropdownMenuItem>Subscription</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Block>
  )
}

const HoverCard = () => {
  return (
    <Block title="HoverCard">
      <HoverCard_>
        <HoverCardTrigger asChild>
          <Button>Hover</Button>
        </HoverCardTrigger>
        <HoverCardContent>The React Framework – created and maintained by @vercel.</HoverCardContent>
      </HoverCard_>
    </Block>
  )
}

const InputDemo = () => {
  return (
    <Block title="Input">
      <Input placeholder="Name" />
      <Input placeholder="Disabled" disabled />
      <Separator />
      <InputWithLabel label="Label" description="Description" helper="Helper" placeholder="Name" />
      <InputWithLabel label="Label" optional placeholder="Name" />
      <Separator />
      <InputWithLabel label="Label" placeholder="Name" />
      <InputWithLabel label="Label" placeholder="Name" />
    </Block>
  )
}

const PopoverDemo = () => {
  return (
    <Block title="Popover">
      <Popover>
        <PopoverTrigger asChild>
          <Button>Open</Button>
        </PopoverTrigger>
        <PopoverContent>Place content for the popover here.</PopoverContent>
      </Popover>
    </Block>
  )
}

const ProgressDemo = () => {
  return (
    <Block title="Progress">
      <Progress value={33} />
    </Block>
  )
}

const RadioGroupDemo = () => {
  return (
    <Block title="RadioGroup">
      <RadioGroup>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="option-one" id="option-one" />
          <Label htmlFor="option-one">Option One</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="option-two" id="option-two" />
          <Label htmlFor="option-two">Option Two</Label>
        </div>
      </RadioGroup>
    </Block>
  )
}

const SelectDemo = () => {
  return (
    <Block title="Select">
      <Select>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
          <SelectItem value="system">System</SelectItem>
        </SelectContent>
      </Select>
    </Block>
  )
}

const SliderDemo = () => {
  return (
    <Block title="Slider">
      <Slider defaultValue={[33]} max={100} step={1} />
    </Block>
  )
}

const SwitchDemo = () => {
  return (
    <Block title="Switch">
      <Switch />
    </Block>
  )
}

const TabsDemo = () => {
  return (
    <Block title="Tabs">
      <Tabs defaultValue="account" className="w-[400px]">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="user">User</TabsTrigger>
        </TabsList>
        <TabsContent value="account">Make changes to your account here.</TabsContent>
        <TabsContent value="user">Change your User info here.</TabsContent>
      </Tabs>
    </Block>
  )
}

const TextareaDemo = () => {
  return (
    <Block title="Textarea">
      <Textarea />
    </Block>
  )
}

const TooltipDemo = () => {
  return (
    <Block title="Tooltip">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button>Tooltip</Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Add to library</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </Block>
  )
}

export function TestPrimitives() {
  return (
    <BlockContainer>
      <AvatarDemo />
      {/* <CalendarDemo /> */}
      {/* <ComboboxDemo /> */}
      <AccordionDemo />
      <CollapsibleDemo />
      <ProgressDemo />
      <SliderDemo />
      <SwitchDemo />
      <CheckboxDemo />
      <SelectDemo />
      <RadioGroupDemo />
      <TextareaDemo />
      <TabsDemo />
      <CommandDemo />
      <CardDemo />
      <AlertDemo />
      <BadgeDemo />
      <InputDemo />
      <ButtonDemo />
      <ContextMenuDmeo />
      <AlertDialogDemo />
      <DialogDemo />
      <DrawerDemo />
      <DropdownMenuDemo />
      <HoverCard />
      <PopoverDemo />
      <TooltipDemo />
    </BlockContainer>
  )
}
