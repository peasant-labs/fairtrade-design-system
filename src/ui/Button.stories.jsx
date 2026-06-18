import Button, { ButtonGroup, Segmented } from './Button.jsx'
import { Download, List, LayoutGrid } from 'lucide-react'

/* reference story (also the toolchain smoke test). CSF3: a Playground driven by argTypes
   plus one named story per meaningful state. classes + tokens come from src/index.css via
   .storybook/preview.jsx; the theme toolbar flips data-theme. */
const meta = {
  title: 'controls/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['md', 'sm'] },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    children: { control: 'text' },
  },
  args: { children: 'publish transcript', variant: 'secondary', size: 'md' },
  parameters: { layout: 'padded' },
}
export default meta

export const Playground = {}
export const Primary = { args: { variant: 'primary' } }
export const Loading = { args: { variant: 'primary', loading: true, children: 'publishing' } }
export const Disabled = { args: { disabled: true } }
export const DisabledStates = {
  render: () => (
    <div className="btn-row">
      {['primary', 'secondary', 'ghost', 'danger'].map((v) => (
        <Button key={v} variant={v} disabled>
          {v}
        </Button>
      ))}
    </div>
  ),
}
export const LoadingDisabled = { args: { variant: 'primary', loading: true, disabled: true, children: 'publishing' } }
export const DisabledLink = { args: { as: 'a', href: '#', disabled: true, children: 'open transcript' } }
export const WithIcon = { args: { variant: 'primary', icon: Download, children: 'export' } }
export const IconOnly = { args: { icon: Download, 'aria-label': 'export', children: undefined } }
export const Small = { args: { size: 'sm' } }
export const Group = {
  render: () => (
    <ButtonGroup label="view">
      <Button icon={List}>list</Button>
      <Button icon={LayoutGrid}>grid</Button>
    </ButtonGroup>
  ),
}
export const SegmentedControl = {
  render: () => (
    <Segmented
      label="layout"
      options={[
        { value: 'list', label: 'list', icon: List },
        { value: 'grid', label: 'grid', icon: LayoutGrid },
      ]}
      defaultValue="list"
    />
  ),
}
