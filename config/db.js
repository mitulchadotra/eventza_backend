import mongoose from 'mongoose'

const connectDb = async () => {
    const uri = process.env.MONGODB_URI
    if (!uri) {
        throw new Error('MONGODB_URI is not set')
    }

    const conn = await mongoose.connect(uri)
    console.log(`Connected successfully: ${conn.connection.host}`)
}
export default connectDb