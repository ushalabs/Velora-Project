import { ComponentProps, ComponentRef, ComponentType, PropsWithoutRef, ReactElement, RefAttributes } from 'react';
import { Animated } from 'react-native';
import type { ComponentStyle, MotionComponentProps } from './Interfaces';
type MotionComponentBaseProps<TComponent extends ComponentType<any>, TExtraProps> = ComponentProps<TComponent> & TExtraProps & MotionComponentProps<TComponent, ComponentStyle<TComponent>, any, any, TExtraProps>;
type MotionComponentWithGenerics<TComponent extends ComponentType<any>, TExtraProps> = PropsWithoutRef<MotionComponentBaseProps<TComponent, TExtraProps>> & RefAttributes<ComponentRef<TComponent>> & {
    <TAnimate = unknown, TAnimateProps = unknown>(props: ComponentProps<TComponent> & TExtraProps & MotionComponentProps<TComponent, ComponentStyle<TComponent>, TAnimate, TAnimateProps, TExtraProps>): ReactElement | null;
};
export declare function createMotionComponent<T extends ComponentType<any>, TExtraProps = {}>(Component: Animated.AnimatedComponent<T> | T): MotionComponentWithGenerics<T, TExtraProps>;
export declare function createMotionAnimatedComponent<T extends ComponentType<any>>(component: T): MotionComponentWithGenerics<T, {}>;
export {};
