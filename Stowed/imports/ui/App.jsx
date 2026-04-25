import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { ItemList } from './ItemList';
import { ItemForm } from './ItemForm';


export function App() {
    return (
        <BrowserRouter>
            <main className='min-h-screen bg-slate-50 text-slate-900'>
                <section className='mx-auto w-full px-4 py-10 md:px-6'>
                    <h1 className='mb-4 text-center text-4xl font-bold tracking-tight text-blue-700'>Inventory Management</h1>
                    <div className='mb-8 w-full border-t-2 border-slate-300'/>
                    <Routes>
                        <Route path='/' element={<ItemList />} />
                        <Route path='/items/new' element={<ItemForm/>} />
                        <Route path='/items/:itemId/edit' element={<ItemForm mode='edit' />} />
                        <Route path='*' element={<Navigate to='/' replace/>} />
                    </Routes>
                </section>
            </main>
        </BrowserRouter>
    );
}
