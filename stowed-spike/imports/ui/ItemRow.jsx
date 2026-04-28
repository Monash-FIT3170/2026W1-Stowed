import { useNavigate } from 'react-router-dom';


export function ItemRow({ item }) {
    const navigate = useNavigate();


    return  (
        <tr key={item._id}>
            <td>{item.name}</td>
            <td>{item.quantity}</td>
            <td>{item.location}</td>
            <td className="whitespace-nowrap py-2 text-center">
                <button className='btn btn-primary' onClick={() => navigate(`/items/${item._id}/edit`)}>Edit</button>
                <button className='btn btn-danger ml-4' onClick={() => Meteor.call('items.delete', { _id: item._id })}>Delete</button>
            </td>
        </tr>
    );
}
